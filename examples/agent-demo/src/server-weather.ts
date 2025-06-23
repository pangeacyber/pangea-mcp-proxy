#!/usr/bin/env node

import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod';

async function main() {
  const server = new MCPServer({
    name: 'Weather MCP Server',
    version: '1.0.0',
    tools: {
      getWeather: createTool({
        id: 'get_weather',
        description: [
          'Get the weather for a given location',
          '',
          'Examples of supported location types:',
          '- paris: city name',
          '- muc: airport code (3 letters)',
          '- 94107: area codes',
          '- -78.46,106.79: GPS coordinates',
        ].join('\n'),
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        outputSchema: z.string(),
        execute: async ({ context: { location } }) => {
          const response = await fetch(`https://wttr.in/${location}?A&T`);
          return await response.text();
        },
      }),
    },
  });

  await server.startStdio();
}

main();
