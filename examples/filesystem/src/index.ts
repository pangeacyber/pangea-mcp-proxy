#!/usr/bin/env node

import {
  BedrockRuntimeClient,
  type ContentBlock,
  ConversationRole,
  ConverseCommand,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import dotenv from '@dotenvx/dotenvx';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { z } from 'zod';

dotenv.config({ overload: true, quiet: true });

const zContentSchema = z.array(
  z.union([
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({
      type: z.literal('image'),
      data: z.string(),
      mimeType: z.string(),
    }),
  ])
);

const main = defineCommand({
  args: {
    input: {
      type: 'string',
      description: 'Input to the agent.',
    },
    path: {
      type: 'string',
      default: './',
    },
    awsModelId: {
      type: 'string',
      default: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    },
    awsRegion: {
      type: 'string',
      default: 'us-west-2',
    },
  },
  async run({ args }) {
    // Start and connect to the proxied MCP server.
    const transport = new StdioClientTransport({
      command: 'node',
      args: [
        '../../dist/proxy.js',
        '--',
        'npx',
        '-y',
        '@modelcontextprotocol/server-filesystem',
        args.path,
      ],
      env: {
        PANGEA_VAULT_TOKEN: process.env.PANGEA_VAULT_TOKEN!,
        PANGEA_VAULT_ITEM_ID: process.env.PANGEA_VAULT_ITEM_ID!,
      },
    });

    const client = new Client({ name: 'client', version: '1.0.0' });

    try {
      // Connect to the transport.
      await client.connect(transport);

      // Get tools.
      const toolsResult = await client.listTools();
      const tools = toolsResult.tools.map((tool) => ({
        toolSpec: {
          name: tool.name,
          description: tool.description,
          inputSchema: { json: JSON.parse(JSON.stringify(tool.inputSchema)) },
        },
      }));
      consola.log(
        'Connected to MCP server with tools:',
        tools.map(({ toolSpec }) => `\n- ${toolSpec.name}`).join('')
      );
      consola.log('');

      const bedrock = new BedrockRuntimeClient({ region: args.awsRegion });

      async function converse(conversation: Message[]) {
        const command = new ConverseCommand({
          modelId: args.awsModelId,
          messages: conversation,
          toolConfig: { tools },
        });
        return await bedrock.send(command);
      }

      const conversation: Message[] = [
        {
          role: ConversationRole.USER,
          content: [{ text: args.input }],
        },
      ];

      while (true) {
        const response = await converse(conversation);
        if (!response.output?.message) {
          return;
        }
        conversation.push(response.output?.message);

        if (response.stopReason === 'tool_use') {
          const toolResults: ContentBlock.ToolResultMember[] = [];
          for (const contentBlock of response.output?.message?.content ?? []) {
            if (contentBlock.text) {
              consola.log(contentBlock.text);
            }

            if (contentBlock.toolUse) {
              const toolName = contentBlock.toolUse.name!;
              const toolArgs = contentBlock.toolUse.input as {
                [x: string]: unknown;
              };

              consola.log('');
              consola.log(
                `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
              );
              consola.log('');

              const toolCallResult = await client.callTool({
                name: toolName,
                arguments: toolArgs,
              });

              const { success, data: parsedToolResultContent } =
                zContentSchema.safeParse(toolCallResult.content);
              if (
                !success ||
                parsedToolResultContent.some((c) => c.type === 'image')
              ) {
                consola.error('Invalid tool result:', toolCallResult.content);
                continue;
              }

              toolResults.push({
                toolResult: {
                  toolUseId: contentBlock.toolUse.toolUseId,
                  // @ts-expect-error
                  content: parsedToolResultContent,
                },
              });

              // Embed the tool results in a new user message.
              conversation.push({
                role: ConversationRole.USER,
                content: toolResults,
              });
            }
          }
        }

        if (response.stopReason === 'end_turn') {
          consola.log(response.output?.message?.content?.[0]?.text);
          return;
        }
      }
    } catch (e) {
      consola.error(e);
    } finally {
      await client.close();
    }
  },
});

runMain(main);
