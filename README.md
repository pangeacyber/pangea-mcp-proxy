# Pangea MCP proxy

Protect any MCP server from malicious entities and confidential PII. The Pangea
MCP proxy secures any existing MCP stdio-based server with the
[Pangea AI Guard][] service, guarding tools' inputs and outputs from content
like malicious IP addresses and Social Security numbers.

## Prerequisites

- Node.js v22.15.0 or greater.
- A Pangea API token with access to AI Guard. See [Service Tokens][] for
  documentation on how to create and manage Pangea API tokens.

## Usage

In an existing MCP servers configuration like the following:

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
    "timeserver": {
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
        "PANGEA_API_TOKEN": "pts_00000000000000000000000000000000"
      }
    }
  }
}
```

The value of `PANGEA_API_TOKEN` should be updated to the Pangea API token that
has access to AI Guard.

[Pangea AI Guard]: https://pangea.cloud/docs/ai-guard/
[Service Tokens]: https://pangea.cloud/docs/admin-guide/projects/credentials#service-tokens
