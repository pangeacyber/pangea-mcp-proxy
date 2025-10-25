FROM node:22.21.0-alpine@sha256:bd26af08779f746650d95a2e4d653b0fd3c8030c44284b6b98d701c9b5eb66b9 AS base

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
