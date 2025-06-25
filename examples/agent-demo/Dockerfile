FROM node:22.16.0-alpine@sha256:41e4389f3d988d2ed55392df4db1420ad048ae53324a8e2b7c6d19508288107e AS base

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
