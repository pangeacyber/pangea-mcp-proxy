#!/usr/bin/env node

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from '@dotenvx/dotenvx';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { defineCommand, runMain } from 'citty';
import consola from 'consola';
import { AIGuardService, PangeaConfig, VaultService } from 'pangea-node-sdk';

dotenv.config({ ignore: ['MISSING_ENV_FILE'], overload: true, quiet: true });

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
  meta: {
    name: 'agent-demo',
    version: '0.0.0',
    description: 'A demo agent that uses MCP servers.',
  },
  args: {
    input: {
      type: 'string',
      description: 'Input to the agent.',
      default:
        'Compose a morning report of the weather in Paris and any recent MLS results.',
    },
    provider: {
      // TODO: switch to enum type when citty publishes a new release.
      // type: 'enum',
      // options: ['openai', 'bedrock'],
      type: 'string',
      description: 'Model provider. Must be one of: openai, bedrock.',
      default: 'bedrock',
    },
    model: {
      type: 'string',
      default: 'meta.llama3-1-70b-instruct-v1:0',
    },
    openaiBaseUrl: {
      type: 'string',
      description: 'URL prefix for OpenAI API calls.',
      default: 'https://api.openai.com/v1',
    },
    awsRegion: {
      type: 'string',
      description: 'AWS region for Bedrock API calls.',
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

    if (!['openai', 'bedrock'].includes(args.provider)) {
      throw new Error(
        'Invalid model provider. Must be one of: openai, bedrock'
      );
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
      model:
        args.provider === 'openai'
          ? createOpenAI({
              baseURL: args.openaiBaseUrl,
              compatibility: 'compatible',
            })(args.model)
          : createAmazonBedrock({ region: args.awsRegion })(args.model),
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
