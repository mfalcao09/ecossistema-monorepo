# syntax=docker/dockerfile:1.7
# ---- build ----
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Compiladores pra possíveis deps nativas (canvas é opcional na Baileys)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config python3 \
  && rm -rf /var/lib/apt/lists/*

# Monorepo — copy raiz + filter do workspace que importa
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/whatsapp-types ./packages/whatsapp-types
COPY apps/whatsapp-gateway ./apps/whatsapp-gateway

RUN corepack enable && pnpm install --filter @ecossistema/whatsapp-gateway... --frozen-lockfile
RUN pnpm --filter @ecossistema/whatsapp-types build \
 && pnpm --filter @ecossistema/whatsapp-gateway build

# ---- runtime ----
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=prod

# deps runtime apenas (pnpm deploy produz node_modules consolidado)
COPY --from=build /app/apps/whatsapp-gateway/dist ./dist
COPY --from=build /app/apps/whatsapp-gateway/package.json ./
COPY --from=build /app/apps/whatsapp-gateway/node_modules ./node_modules
COPY --from=build /app/packages/whatsapp-types ./packages/whatsapp-types

# Bind 0.0.0.0 conforme convenção Railway
EXPOSE 3030
CMD ["node", "dist/index.js"]

# Healthcheck TCP (Railway)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('net').createConnection(process.env.PORT||3030,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
