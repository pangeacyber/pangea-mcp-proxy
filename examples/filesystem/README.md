A sample agent that uses the Pangea MCP proxy to communicate with the
[Filesystem MCP Server][].

## Prerequisites

- Node.js v22.15.0 or greater.
- A Pangea API token with access to AI Guard. This token needs to be stored in
  Pangea Vault. See [Service Tokens][] for documentation on how to create and
  manage Pangea API tokens.
- A Pangea API token with access to Vault. This will be used to fetch the above
  token at runtime.

## Usage

Set the following environments variables:

- `PANGEA_VAULT_TOKEN`: Pangea Vault API token.
- `PANGEA_VAULT_ITEM_ID`: Pangea Vault item ID of the Vault item that contains
  the Pangea AI Guard API token.
- `AWS_ACCESS_KEY_ID`: AWS access key.
- `AWS_SECRET_ACCESS_KEY`: Secret key associated with the AWS access key.

For convenience, these may be defined in a `.env` file next to this `README.md`
file.

Then, starting from the root of this repository, run:

```bash
pnpm install

cd examples/filesystem
pnpm run build
```

Then the agent can be invoked like so:

```bash
node ./dist/index.js --input "get info on the local package.json file"
```

[Service Tokens]: https://pangea.cloud/docs/admin-guide/projects/credentials#service-tokens
[Filesystem MCP Server]: https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem
