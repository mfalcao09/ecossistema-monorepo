# Dockerfile Railway-ready para MCP servers Ecossistema.
# Multi-stage: dependências numa layer, código em outra (cache-friendly).

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Deps de sistema cobrem os dois casos que travam build no python:3.12-slim:
#   - cryptography (via pyjwt[crypto]) → precisa libssl, libffi, gcc se
#     cair em build-from-source (Rust só é exigido em cryptography ≥ 35
#     quando não há wheel; o pacote cargo cobre esse fallback).
#   - hiredis (via redis[hiredis]) → extensão C, precisa gcc/python3-dev.
# Mantém a imagem enxuta: --no-install-recommends + limpeza do apt cache.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libssl-dev \
        libffi-dev \
        pkg-config \
        cargo \
        python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- deps ------------------------------------------------------------------
FROM base AS deps
# README.md é obrigatório: pyproject.toml declara `readme = "README.md"`
# e Hatchling (build backend) valida a existência do arquivo mesmo para
# gerar só a metadata — sem copiar, quebra com OSError: Readme file does
# not exist.
COPY pyproject.toml README.md ./
# pip 25 é mais previsível que 26 (recém-lançado) para resolver deps do
# ecossistema. Fixa pra evitar surpresa até o ecossistema validar 26+.
RUN pip install --upgrade 'pip<26' \
    && pip install --no-cache-dir .

# --- runtime ---------------------------------------------------------------
FROM base AS runtime
COPY --from=deps /usr/local /usr/local
COPY src/ ./src/
COPY pyproject.toml README.md ./
RUN pip install --no-deps -e .

# Usuário não-root
RUN useradd --create-home --shell /bin/bash mcp
USER mcp

EXPOSE 8080
CMD ["python", "-m", "template_mcp.server"]
