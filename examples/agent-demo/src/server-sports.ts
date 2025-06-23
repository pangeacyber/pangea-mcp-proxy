#!/usr/bin/env node

import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod';

async function main() {
  const server = new MCPServer({
    name: 'Sports MCP Server',
    version: '1.0.0',
    tools: {
      getMlsScoreboard: createTool({
        id: 'get_mls_scoreboard',
        description: 'Get the current Major League Soccer (MLS) scoreboard',
        inputSchema: z.object({}),
        outputSchema: z.string(),
        execute: async () => {
          const response = await fetch('https://plaintextsports.com/mls/');
          return await response.text();
        },
      }),
    },
  });

  await server.startStdio();
}

main();
