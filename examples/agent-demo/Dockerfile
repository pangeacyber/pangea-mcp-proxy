FROM node:22.15.0-alpine@sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd AS base

LABEL name="agent-demo"
LABEL org.opencontainers.image.source="https://github.com/pangeacyber/pangea-mcp-proxy" \
  org.opencontainers.image.url="https://pangea.cloud" \
  org.opencontainers.image.licenses="Apache-2.0"

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm deploy --filter=@pangeacyber/mcp-proxy-agent-demo --prod /prod/agent-demo

FROM base AS release

ENV NODE_ENV=production

COPY --from=build /prod/agent-demo /prod/agent-demo
WORKDIR /prod/agent-demo

ENTRYPOINT ["node", "/prod/agent-demo/dist/client.js"]
