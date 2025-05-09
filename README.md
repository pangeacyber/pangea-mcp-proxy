# Pangea MCP proxy

Protect any MCP server from malicious entities and confidential PII. The Pangea
MCP proxy secures any existing MCP stdio-based server with the
[Pangea AI Guard][] service, guarding tools' inputs and outputs from content
like malicious IP addresses and Social Security numbers.

## Prerequisites

- Node.js v22.15.0 or greater.
- A Pangea API token with access to AI Guard. This token needs to be stored in
  Pangea Vault. See [Service Tokens][] for documentation on how to create and
  manage Pangea API tokens.
- A Pangea API token with access to Vault. This will be used to fetch the above
  token at runtime.

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

[Pangea AI Guard]: https://pangea.cloud/docs/ai-guard/
[Service Tokens]: https://pangea.cloud/docs/admin-guide/projects/credentials#service-tokens
