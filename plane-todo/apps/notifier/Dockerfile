# Build from the monorepo root: `docker build -f apps/notifier/Dockerfile .`
FROM node:18-bookworm-slim

# better-sqlite3 needs a toolchain if no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY apps/notifier/package.json apps/notifier/

RUN pnpm install --frozen-lockfile || pnpm install

# Copy sources and build the core package.
COPY . .
RUN pnpm --filter @plane-todo/core build

ENV NODE_ENV=production
ENV DB_PATH=/data/notifier.db
VOLUME ["/data"]

EXPOSE 3005
WORKDIR /app/apps/notifier
CMD ["pnpm", "start"]
