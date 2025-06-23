#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  LoggingMessageNotificationSchema,
  ReadResourceRequestSchema,
  ResourceUpdatedNotificationSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { AIGuardService, PangeaConfig, VaultService } from 'pangea-node-sdk';

const main = defineCommand({
  args: {},
  async run({ args }) {
    if (!process.env.PANGEA_VAULT_TOKEN) {
      throw new Error('Missing environment variable: PANGEA_VAULT_TOKEN');
    }
    if (!process.env.PANGEA_VAULT_ITEM_ID) {
      throw new Error('Missing environment variable: PANGEA_VAULT_ITEM_ID');
    }

    if (args._.length < 1) {
      consola.error('No command provided.');
      process.exit(1);
    }

    const clientTransport = new StdioClientTransport({
      command: args._[0],
      args: args._.slice(1),
      env: process.env as Record<string, string>,
      stderr: 'pipe',
    });
    const client = new Client(
      {
        name: 'pangea-mcp-proxy-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(clientTransport);

    const serverTransport = new StdioServerTransport();
    const serverCapabilities = client.getServerCapabilities();
    const serverVersion = client.getServerVersion() as {
      name: string;
      version: string;
    };
    const server = new Server(serverVersion, {
      capabilities: serverCapabilities,
    });

    if (serverCapabilities?.logging) {
      server.setNotificationHandler(LoggingMessageNotificationSchema, (args) =>
        client.notification(args)
      );
    }

    if (serverCapabilities?.prompts) {
      server.setRequestHandler(GetPromptRequestSchema, (args) =>
        client.getPrompt(args.params)
      );
      server.setRequestHandler(ListPromptsRequestSchema, (args) =>
        client.listPrompts(args.params)
      );
    }

    if (serverCapabilities?.resources) {
      server.setRequestHandler(ListResourcesRequestSchema, (args) =>
        client.listResources(args.params)
      );
      server.setRequestHandler(ListResourceTemplatesRequestSchema, (args) =>
        client.listResourceTemplates(args.params)
      );
      server.setRequestHandler(ReadResourceRequestSchema, (args) =>
        client.readResource(args.params)
      );

      if (serverCapabilities?.resources.subscribe) {
        server.setNotificationHandler(
          ResourceUpdatedNotificationSchema,
          (args) => client.notification(args)
        );
        server.setRequestHandler(SubscribeRequestSchema, (args) =>
          client.subscribeResource(args.params)
        );
        server.setRequestHandler(UnsubscribeRequestSchema, (args) =>
          client.unsubscribeResource(args.params)
        );
      }
    }

    if (serverCapabilities?.tools) {
      const vault = new VaultService(
        process.env.PANGEA_VAULT_TOKEN!,
        new PangeaConfig({ domain: 'aws.us.pangea.cloud' })
      );
      const vaultItem = await vault.getItem({
        id: process.env.PANGEA_VAULT_ITEM_ID!,
      });
      if (!vaultItem.success) {
        throw new Error('Failed to get API token from Pangea Vault.');
      }

      const aiGuard = new AIGuardService(
        vaultItem.result.item_versions[0].token!,
        new PangeaConfig({ domain: 'aws.us.pangea.cloud' })
      );

      server.setRequestHandler(ListToolsRequestSchema, async (args) => {
        const response = await client.listTools(args.params);
        const { tools } = response;
        const guardedToolsList = await aiGuard.guardText({
          text: tools
            .map(
              (tool) => `Tool: ${tool.name}\nDescription: ${tool.description}\n`
            )
            .join('\n'),
          overrides: {
            ignore_recipe: true,
            prompt_injection: {
              action: 'block',
              disabled: false,
            },
          },
        });

        if (!guardedToolsList.success) {
          throw new Error('Failed to guard tools list.');
        }

        return guardedToolsList.result.blocked
          ? { ...response, tools: [] }
          : response;
      });

      server.setRequestHandler(CallToolRequestSchema, async (args) => {
        const guardedInput = await aiGuard.guardText({
          text: JSON.stringify(args.params.arguments),
          recipe: 'pangea_agent_pre_tool_guard',
        });

        if (!guardedInput.success) {
          throw new Error('Failed to guard input.');
        }

        if (guardedInput.result.blocked) {
          const { prompt_messages, prompt_text, ...rest } = guardedInput.result;
          return {
            content: [
              {
                type: 'text',
                text: `Input has been blocked by Pangea AI Guard.\n\n${JSON.stringify(rest, null, 2)}`,
              },
            ],
          };
        }

        const response = await client.callTool({
          ...args.params,
          arguments: JSON.parse(guardedInput.result.prompt_text!),
        });
        const { content } = response as {
          content: { type: string; text: string }[];
        };

        for (const contentItem of content.filter((c) => c.type === 'text')) {
          const guardedOutput = await aiGuard.guardText({
            text: contentItem.text,
            recipe: 'pangea_agent_post_tool_guard',
          });

          if (!guardedOutput.success) {
            throw new Error('Failed to guard output.');
          }

          if (guardedOutput.result.blocked) {
            const { prompt_messages, prompt_text, ...rest } =
              guardedOutput.result;
            return {
              content: [
                {
                  type: 'text',
                  text: `Output has been blocked by Pangea AI Guard.\n\n${JSON.stringify(rest, null, 2)}`,
                },
              ],
            };
          }

          contentItem.text = guardedOutput.result.prompt_text!;
        }

        return response;
      });
    }

    server.setRequestHandler(CompleteRequestSchema, (args) =>
      client.complete(args.params)
    );

    await server.connect(serverTransport);
  },
});

runMain(main);
