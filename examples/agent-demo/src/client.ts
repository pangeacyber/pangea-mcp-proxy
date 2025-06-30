#!/usr/bin/env node

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from '@dotenvx/dotenvx';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PinoLogger } from '@mastra/loggers';
import { MCPClient } from '@mastra/mcp';
import { defineCommand, runMain } from 'citty';
import consola from 'consola';
import { AIGuardService, PangeaConfig } from 'pangea-node-sdk';

dotenv.config({ ignore: ['MISSING_ENV_FILE'], overload: true, quiet: true });

function mcpProxy(args: readonly string[]) {
  return {
    command: 'npx',
    args: ['-y', '@pangeacyber/mcp-proxy', '--', ...args],
    env: {
      PANGEA_VAULT_TOKEN: process.env.PANGEA_VAULT_TOKEN!,
      PANGEA_VAULT_ITEM_ID: process.env.PANGEA_VAULT_ITEM_ID!,
      PANGEA_BASE_URL_TEMPLATE: process.env.PANGEA_BASE_URL_TEMPLATE!,
      APP_NAME: 'My AI Agent',
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
    if (!process.env.PANGEA_AIDR_TOKEN) {
      throw new Error('Missing environment variable: PANGEA_AIDR_TOKEN');
    }
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
      instructions: `Today is ${new Date().toISOString().split('T')[0]}. Use the provided tools to prepare a morning report for the user.`,
      model:
        args.provider === 'openai'
          ? createOpenAI({
              baseURL: args.openaiBaseUrl,
              compatibility: 'compatible',
            })(args.model)
          : createAmazonBedrock({ region: args.awsRegion })(args.model),
      tools: await mcp.getTools(),
    });

    const _mastra = new Mastra({
      agents: { agent },
      logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
      telemetry: {
        serviceName: 'agent-demo',
        enabled: true,
        sampling: { type: 'always_on' },
        export: { type: 'otlp', protocol: 'http' },
      },
    });

    const pangeaConfig = new PangeaConfig({
      baseUrlTemplate: process.env.PANGEA_BASE_URL_TEMPLATE,
    });

    const aiGuard = new AIGuardService(
      process.env.PANGEA_AIDR_TOKEN!,
      pangeaConfig
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
      temperature: 0.1,
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
