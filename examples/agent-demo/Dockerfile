FROM node:22.21.1-alpine@sha256:9632533eda8061fc1e9960cfb3f8762781c07a00ee7317f5dc0e13c05e15166f AS base

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
