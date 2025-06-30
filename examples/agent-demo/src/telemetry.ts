import dotenv from '@dotenvx/dotenvx';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter as OTLPHttpExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

dotenv.config({ ignore: ['MISSING_ENV_FILE'], overload: true, quiet: true });

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'agent-demo' }),
  sampler: new AlwaysOnSampler(),
  traceExporter: new OTLPHttpExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Gracefully shut down the SDK on process exit.
process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => {
    // No-op.
  });
});
