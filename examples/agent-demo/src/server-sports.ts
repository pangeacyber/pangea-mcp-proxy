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
        // biome-ignore lint/suspicious/useAwait: matches expected signature.
        execute: async () => {
          // Uncomment to use live data.
          // const response = await fetch('https://plaintextsports.com/mls/');
          // return await response.text();

          // Mock data.
          return `
+---------------+
|  11:30 PM UTC |
| TOR    3-10-4 |
| RBNY    8-7-3 |
+---------------+

+---------------+
|  11:30 PM UTC |
| NE      6-5-5 |
| NSH     9-4-5 |
+---------------+

+---------------+
|  11:30 PM UTC |
| MTL    2-11-5 |
| CIN    10-5-3 |
+---------------+

+---------------+
|  11:30 PM UTC |
| CLB     8-3-7 |
| ATL     4-9-5 |
+---------------+

+---------------+
|  12:30 AM UTC |
| STL     3-9-6 |
| ORL     8-4-6 |
+---------------+

+---------------+
|  12:30 AM UTC |
| MIN     8-4-6 |
| HOU     5-8-5 |
+---------------+

+---------------+
|  12:30 AM UTC |
| SKC    4-10-4 |
| CLT     8-9-1 |
+---------------+

+---------------+
|  12:30 AM UTC |
| DAL     5-6-6 |
| SJ      6-7-5 |
+---------------+

+---------------+
|  12:30 AM UTC |
| CHI     7-6-4 |
| PHI    11-3-4 |
+---------------+

+---------------+
|   1:30 AM UTC |
| COL     6-8-4 |
| LA     1-12-5 |
+---------------+

+---------------+
|   2:30 AM UTC |
| VAN    10-2-5 |
| SD     10-5-3 |
+---------------+
          `;
        },
      }),
    },
  });

  await server.startStdio();
}

main();
