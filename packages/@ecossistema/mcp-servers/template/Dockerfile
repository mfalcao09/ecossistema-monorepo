# Dockerfile Railway-ready para MCP servers Ecossistema.
# Multi-stage: dependências numa layer, código em outra (cache-friendly).

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# --- deps ------------------------------------------------------------------
FROM base AS deps
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install --no-cache-dir .

# --- runtime ---------------------------------------------------------------
FROM base AS runtime
COPY --from=deps /usr/local /usr/local
COPY src/ ./src/
COPY pyproject.toml ./
RUN pip install --no-deps -e .

# Usuário não-root
RUN useradd --create-home --shell /bin/bash mcp
USER mcp

EXPOSE 8080
CMD ["python", "-m", "template_mcp.server"]
