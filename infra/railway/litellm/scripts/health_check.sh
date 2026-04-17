#!/usr/bin/env bash
# Sanity check do LiteLLM proxy.
#
# Uso:
#   export LITELLM_URL=https://litellm.ecossistema.internal
#   export LITELLM_MASTER_KEY=sk-litellm-master-xxxx
#   ./scripts/health_check.sh
set -euo pipefail

: "${LITELLM_URL:?LITELLM_URL não definida}"
: "${LITELLM_MASTER_KEY:?LITELLM_MASTER_KEY não definida}"

echo "==> /health/readiness"
curl -fsS "$LITELLM_URL/health/readiness" | tee /dev/stderr
echo

echo "==> /health/liveliness"
curl -fsS "$LITELLM_URL/health/liveliness" | tee /dev/stderr
echo

echo "==> /v1/models (listagem)"
curl -fsS "$LITELLM_URL/v1/models" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  | python -m json.tool

echo "==> /health (upstream providers)"
curl -fsS "$LITELLM_URL/health" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  | python -m json.tool

echo "✅ health_check concluído"
