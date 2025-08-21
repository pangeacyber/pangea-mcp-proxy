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
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
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
      const pangeaConfig = new PangeaConfig({
        baseUrlTemplate: process.env.PANGEA_BASE_URL_TEMPLATE,
      });

      const vault = new VaultService(
        process.env.PANGEA_VAULT_TOKEN!,
        pangeaConfig
      );
      const vaultItem = await vault.getItem({
        id: process.env.PANGEA_VAULT_ITEM_ID!,
      });
      if (!vaultItem.success) {
        throw new Error('Failed to get API token from Pangea Vault.');
      }

      const aiGuard = new AIGuardService(
        vaultItem.result.item_versions[0].token!,
        pangeaConfig
      );

      server.setRequestHandler(ListToolsRequestSchema, async (args) => {
        const response = await client.listTools(args.params);
        const { tools } = response;
        const guardedToolsList = await aiGuard.guard({
          input: { messages: [], tools },
          overrides: {
            ignore_recipe: true,
            malicious_prompt: {
              action: 'block',
              disabled: false,
            },
          },
          app_id: process.env.APP_ID,
          extra_info: { app_name: process.env.APP_NAME },
        });

        if (!guardedToolsList.success) {
          throw new Error('Failed to guard tools list.');
        }

        return guardedToolsList.result.blocked
          ? { ...response, tools: [] }
          : response;
      });

      server.setRequestHandler(CallToolRequestSchema, async (args) => {
        const guardedInput = await aiGuard.guard({
          input: {
            messages: [
              {
                role: 'user',
                content: JSON.stringify(args.params.arguments) ?? '',
              },
            ],
          },
          recipe: 'pangea_agent_pre_tool_guard',
          app_id: process.env.APP_ID,
          event_type: 'input',
          extra_info: {
            app_name: process.env.APP_NAME,
            tool_name: args.params.name,
          },
        });

        if (!guardedInput.success) {
          throw new Error('Failed to guard input.');
        }

        if (guardedInput.result.blocked) {
          const { output, ...rest } = guardedInput.result;
          return {
            content: [
              {
                type: 'text',
                text: `Input has been blocked by Pangea AI Guard.\n\n${JSON.stringify(rest, null, 2)}`,
              },
            ],
            isError: true,
          };
        }

        const newArgs: Record<string, unknown> = guardedInput.result.transformed
          ? JSON.parse(
              (guardedInput.result.output?.messages as { content: string }[])[0]
                .content ?? '{}'
            )
          : args.params.arguments;

        const response = await client.callTool({
          ...args.params,
          arguments: newArgs,
        });
        const { content, structuredContent } = response as {
          content: { type: string; text: string }[];
          structuredContent?: object;
        };

        if (structuredContent) {
          // Process structuredContent from tools that return it
          const guardedOutput = await aiGuard.guard({
            input: {
              messages: [
                {
                  role: 'tool',
                  content: JSON.stringify(structuredContent),
                },
              ],
            },
            recipe: 'pangea_agent_post_tool_guard',
            app_id: process.env.APP_ID,
            event_type: 'output',
            extra_info: {
              app_name: process.env.APP_NAME,
              tool_name: args.params.name,
            },
          });

          if (!guardedOutput.success) {
            throw new Error('Failed to guard output.');
          }

          if (guardedOutput.result.blocked) {
            const { output, ...rest } = guardedOutput.result;
            return {
              content: [
                {
                  type: 'text',
                  text: `Output has been blocked by Pangea AI Guard.\n\n${JSON.stringify(rest, null, 2)}`,
                },
              ],
              isError: true,
            };
          }

          if (guardedOutput.result.transformed) {
            const contentText = (
              guardedOutput.result.output?.messages as { content: string }[]
            )[0].content;

            try {
              response.structuredContent = JSON.parse(contentText);

              response.content = [
                {
                  type: 'text',
                  text: JSON.stringify(response.structuredContent),
                },
              ];
            } catch {
              response.content = [
                {
                  type: 'text',
                  text: contentText,
                },
              ];
            }
          }
        } else {
          // Process text content from tools that don't return structuredContent
          for (const contentItem of content.filter((c) => c.type === 'text')) {
            const guardedOutput = await aiGuard.guard({
              input: {
                messages: [
                  {
                    role: 'tool',
                    content: contentItem.text,
                  },
                ],
              },
              recipe: 'pangea_agent_post_tool_guard',
              app_id: process.env.APP_ID,
              event_type: 'output',
              extra_info: {
                app_name: process.env.APP_NAME,
                tool_name: args.params.name,
              },
            });

            if (!guardedOutput.success) {
              throw new Error('Failed to guard output.');
            }

            if (guardedOutput.result.blocked) {
              const { output, ...rest } = guardedOutput.result;
              return {
                content: [
                  {
                    type: 'text',
                    text: `Output has been blocked by Pangea AI Guard.\n\n${JSON.stringify(rest, null, 2)}`,
                  },
                ],
                isError: true,
              };
            }

            if (guardedOutput.result.transformed) {
              contentItem.text = (
                guardedOutput.result.output?.messages as { content: string }[]
              )[0].content;
            }
          }
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
