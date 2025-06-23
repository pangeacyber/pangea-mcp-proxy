#!/usr/bin/env node

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import dotenv from '@dotenvx/dotenvx';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { defineCommand, runMain } from 'citty';
import consola from 'consola';

dotenv.config({ overload: true, quiet: true });

function mcpProxy(args: readonly string[]) {
  return {
    command: 'npx',
    args: ['-y', '@pangeacyber/mcp-proxy', '--', ...args],
    env: {
      PANGEA_VAULT_TOKEN: process.env.PANGEA_VAULT_TOKEN!,
      PANGEA_VAULT_ITEM_ID: process.env.PANGEA_VAULT_ITEM_ID!,
    },
  };
}

const main = defineCommand({
  args: {
    input: {
      type: 'string',
      description: 'Input to the agent.',
      default:
        'Compose a morning report of the weather in Paris and any recent MLS results.',
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
    if (!process.env.PANGEA_VAULT_TOKEN) {
      throw new Error('Missing environment variable: PANGEA_VAULT_TOKEN');
    }
    if (!process.env.PANGEA_VAULT_ITEM_ID) {
      throw new Error('Missing environment variable: PANGEA_VAULT_ITEM_ID');
    }

    const mcp = new MCPClient({
      servers: {
        sports: mcpProxy(['node', 'dist/server-sports.js']),
        weather: mcpProxy(['node', 'dist/server-weather.js']),
      },
    });

    const agent = new Agent({
      name: 'Agent with MCP Tools',
      instructions: 'You can use tools from connected MCP servers.',
      model: createAmazonBedrock({ region: args.awsRegion })(args.awsModelId),
      tools: await mcp.getTools(),
    });

    const abortController = new AbortController();
    const result = await agent.generate(args.input, {
      abortSignal: abortController.signal,
    });
    consola.log(result.text);

    abortController.abort();
    await mcp.disconnect();
    process.exit(0);
  },
});

runMain(main);
