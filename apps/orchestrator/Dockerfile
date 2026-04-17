# ──────────────────────────────────────────────────────────────────────────────
# Ecossistema Orchestrator — Dockerfile multi-stage
#
# Stage 1 (builder): instala deps Python + Node
# Stage 2 (runtime): imagem lean de produção
#
# Convenções canônicas Railway (pós-S3):
#   - COPY pyproject.toml README.md ./ antes do pip
#   - host 0.0.0.0 (não 127.0.0.1)
#   - TCP healthcheck (sem /health sem auth)
#   - build-essential para wheels nativos
#   - pip<26 temporário
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

# Compiladores para wheels nativos (cryptography, hiredis, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libssl-dev libffi-dev pkg-config cargo python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Pin pip temporário (pip 26 pode ter resolver novo com conflitos)
RUN pip install --no-cache-dir "pip<26"

# Instalar deps Python primeiro (layer cache)
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir -e ".[dev]"

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Node.js para hooks_bridge.mjs
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar site-packages do builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Node deps (hooks_bridge.mjs depende de @ecossistema/constitutional-hooks)
COPY package.json ./
# pnpm via corepack (consistente com o monorepo)
RUN npm install -g corepack && corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod || true

# App code
COPY src/ ./src/
COPY hooks_bridge.mjs ./
COPY config/ ./config/

# Usuário não-root (segurança)
RUN useradd -m -u 1001 orchestrator
USER orchestrator

EXPOSE 8000

# TCP healthcheck — sem path porque /health requer auth (consistente com S3)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import socket; s=socket.socket(); s.connect(('localhost', 8000)); s.close()" || exit 1

CMD ["uvicorn", "orchestrator.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--log-level", "info"]
