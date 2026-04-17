# LiteLLM proxy — Ecossistema V9
# Base image oficial da BerriAI (MIT), pin em tag main-latest.
# Para builds reprodutíveis em produção, pinar sha depois.
FROM ghcr.io/berriai/litellm:main-latest

WORKDIR /app

# Config principal + overrides
COPY litellm_config.yaml /app/config.yaml
COPY config/ /app/config/
COPY scripts/ /app/scripts/

# Dependências extras para os scripts Python helpers
RUN pip install --no-cache-dir httpx pyyaml

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:4000/health/readiness || exit 1

# 2 workers uvicorn para fluid-like comportamento.
# Escalar via Railway numReplicas quando carga crescer.
CMD ["--config", "/app/config.yaml", "--port", "4000", "--num_workers", "2"]
