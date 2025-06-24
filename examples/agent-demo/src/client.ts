#!/usr/bin/env node

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import dotenv from '@dotenvx/dotenvx';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { defineCommand, runMain } from 'citty';
import consola from 'consola';
import { AIGuardService, PangeaConfig, VaultService } from 'pangea-node-sdk';

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

    const guardedInput = await aiGuard.guard({
      messages: [
        {
          role: 'user',
          content: args.input,
        },
      ],
      recipe: 'pangea_prompt_guard',
    });

    if (!guardedInput.success) {
      throw new Error('Failed to guard input.');
    }

    if (guardedInput.result.blocked) {
      throw new Error('Input blocked by Pangea AI Guard.');
    }

    const abortController = new AbortController();
    const result = await agent.generate(args.input, {
      abortSignal: abortController.signal,
    });

    const guardedOutput = await aiGuard.guard({
      messages: [
        {
          role: 'user',
          content: args.input,
        },
        {
          role: 'assistant',
          content: result.text,
        },
      ],
      recipe: 'pangea_llm_response_guard',
    });

    if (!guardedOutput.success) {
      throw new Error('Failed to guard output.');
    }

    if (guardedOutput.result.blocked) {
      throw new Error('Output blocked by Pangea AI Guard.');
    }

    consola.log(result.text);

    abortController.abort();
    await mcp.disconnect();
    process.exit(0);
  },
});

runMain(main);
