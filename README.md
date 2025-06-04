# Pangea MCP proxy

Protect any MCP server. Now with 99% less prompt injection! The Pangea MCP proxy
secures any existing MCP server with the [Pangea AI Guard][] service, guarding
tools' inputs and outputs.

What it does: Protect MCP servers from common threat vectors by running all MCP
server I/O through Pangea AI Guard, which blocks:

- Prompt injections (yes, even the ones wrapped in a riddle)
- Malicious links, IPs, domains (via CrowdStrike, DomainTools, WhoisXML threat intel)
- 50 types of confidential information and PII
- 10 content filters, including toxicity, self harm, violence, and filtering by topic
- Support for 104 spoken languages

Bonus: It stores your AI Guard token safely in Pangea Vault, with automatic
rotation.

Extra bonus: Each request to AI Guard and its detection results are logged to
your Secure Audit Log, giving you an immutable trail of activity for audits,
debugging, and incident response.

## Prerequisites

- Node.js v22.15.0 or greater.
- A Pangea API token with access to AI Guard. This token needs to be stored in
  Pangea Vault. See [Service Tokens][] for documentation on how to create and
  manage Pangea API tokens.
- A Pangea API token with access to Vault. This will be used to fetch the above
  token at runtime.

## Usage

In an existing stdio-based MCP server configuration like the following:

```json
{
  "mcpServers": {
    "qrcode": {
      "command": "npx",
      "args": ["-y", "@jwalsh/mcp-server-qrcode"]
    }
  }
}
```

Wrap the original command with `npx -y @pangeacyber/mcp-proxy` and add an
environment variable:

```json
{
  "mcpServers": {
    "qrcode": {
      "command": "npx",
      "args": [
        "-y",
        "@pangeacyber/mcp-proxy",
        "--",
        "npx",
        "-y",
        "@jwalsh/mcp-server-qrcode"
      ],
      "env": {
        "PANGEA_VAULT_TOKEN": "pts_00000000000000000000000000000000",
        "PANGEA_VAULT_ITEM_ID": "pvi_00000000000000000000000000000000"
      }
    }
  }
}
```

1. Update the `PANGEA_VAULT_TOKEN` value to the Pangea Vault API token.
1. Update the `PANGEA_VAULT_ITEM_ID` value to the Vault item ID that contains
   the Pangea AI Guard API token.

For remote servers using HTTP or SSE, use [mcp-remote][] to turn them into stdio
servers:

```json
{
  "mcpServers": {
    "proxied": {
      "command": "npx",
      "args": [
        "-y",
        "@pangeacyber/mcp-proxy",
        "--",
        "npx",
        "-y",
        "mcp-remote",
        "https://remote.mcp.server/sse"
      ],
      "env": {
        "PANGEA_VAULT_TOKEN": "pts_00000000000000000000000000000000",
        "PANGEA_VAULT_ITEM_ID": "pvi_00000000000000000000000000000000"
      }
    }
  }
}
```

[Pangea AI Guard]: https://pangea.cloud/docs/ai-guard/
[Service Tokens]: https://pangea.cloud/docs/admin-guide/projects/credentials#service-tokens
[mcp-remote]: https://github.com/geelen/mcp-remote
