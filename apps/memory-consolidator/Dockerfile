# ──────────────────────────────────────────────────────────────────────────────
# Memory Consolidator — Dockerfile multi-stage
#
# Convenções canônicas Railway (pós-S3, ver MEMORY.md):
#   - COPY pyproject.toml README.md ./ antes do pip
#   - host 0.0.0.0 (não 127.0.0.1)
#   - build-essential para wheels nativos (cryptography, hiredis, etc.)
#   - pip<26 temporário (resolver novo do pip 26 pode conflitar com pins)
#   - Usuário não-root em produção
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libssl-dev libffi-dev pkg-config cargo python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Pin pip (pip 26 pode ter resolver novo com conflitos)
RUN pip install --no-cache-dir "pip<26"

# Deps primeiro — aproveita layer cache Docker
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir .

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copiar pacotes instalados do builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Usuário não-root
RUN useradd -m -u 1001 consolidator
USER consolidator

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["uvicorn", "consolidator.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--workers", "1", \
     "--log-level", "info"]
