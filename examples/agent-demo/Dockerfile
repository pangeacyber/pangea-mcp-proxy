FROM node:22.15.0-alpine@sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd AS base

LABEL name="agent-demo"
LABEL org.opencontainers.image.source="https://github.com/pangeacyber/pangea-mcp-proxy" \
  org.opencontainers.image.url="https://pangea.cloud" \
  org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app
RUN corepack enable

FROM base AS build

ADD . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

RUN pnpm run -r build

FROM base AS release

ENV NODE_ENV=production

COPY --from=build /app/examples/agent-demo/dist /app/examples/agent-demo/dist
COPY --from=build /app/examples/agent-demo/package.json /app/examples/agent-demo/package.json

COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-lock.yaml

RUN pnpm install --frozen-lockfile --prod=true

ENTRYPOINT ["node", "/app/examples/agent-demo/dist/client.js"]
