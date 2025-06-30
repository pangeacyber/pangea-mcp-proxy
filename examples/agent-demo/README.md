## Prerequisites

- Node.js v22.15.0 or greater.
- pnpm v10.12.1 or greater.
- AIDR MCP Sensor configured.

## Usage

Set the following environment variables:

- `PANGEA_VAULT_TOKEN`: Pangea Vault API token from the MCP Sensor Config page.
- `PANGEA_VAULT_ITEM_ID`: Pangea Vault item ID from the MCP Sensor Config page.
- `PANGEA_AIDR_TOKEN`: Pangea API token from the Application Sensor Config page.
- `AWS_ACCESS_KEY_ID`: AWS access key for Bedrock usage.
- `AWS_SECRET_ACCESS_KEY`: Secret key associated with the AWS access key.

For convenience, these may be defined in a `.env` file next to this `README.md`
file.

Then, starting from the root of this repository, run:

```bash
pnpm install

cd examples/agent-demo
pnpm run build
```

Then the agent can be invoked like so:

```bash
node --experimental-loader=@opentelemetry/instrumentation/hook.mjs --import ./dist/telemetry.js ./dist/client.js
```

### OTEL

Set the following [environment variables](https://mastra.ai/en/docs/observability/tracing#environment-variables):

- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP endpoint URL.
- `OTEL_EXPORTER_OTLP_HEADERS`: Optional headers for OTLP requests.

### Custom Pangea base URL

To use a Pangea base URL other than the default
`https://{SERVICE_NAME}.aws.us.pangea.cloud`, set the `PANGEA_BASE_URL_TEMPLATE`
environment variable to a custom template (e.g. `https://{SERVICE_NAME}.dev.pangea.cloud`).
