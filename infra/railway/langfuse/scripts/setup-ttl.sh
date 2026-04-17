#!/usr/bin/env bash
# setup-ttl.sh — aplica TTL de retenção no ClickHouse (evita custo infinito).
#
# Uso:
#   CLICKHOUSE_URL=http://localhost:8123 \
#   CLICKHOUSE_USER=langfuse \
#   CLICKHOUSE_PASSWORD=... \
#   ./scripts/setup-ttl.sh
#
# Retenção:
#   traces       → 30 dias  (volume alto, recoverable)
#   observations → 30 dias
#   scores/evals → 365 dias (baixo volume, evidência histórica)
#
# Rodar 1x após Langfuse migrar suas tabelas (~1 min depois do boot inicial).

set -euo pipefail

: "${CLICKHOUSE_URL:?CLICKHOUSE_URL obrigatório}"
: "${CLICKHOUSE_USER:?CLICKHOUSE_USER obrigatório}"
: "${CLICKHOUSE_PASSWORD:?CLICKHOUSE_PASSWORD obrigatório}"

exec_sql() {
  local sql="$1"
  echo "▶ $sql"
  curl -sSf \
    -u "$CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD" \
    --data-binary "$sql" \
    "$CLICKHOUSE_URL" || {
      echo "✗ falhou — tabela já tem TTL? rodando IGNORE e seguindo..."
    }
  echo ""
}

echo "▶ Aplicando TTL em ClickHouse: $CLICKHOUSE_URL"
echo ""

exec_sql "ALTER TABLE traces       MODIFY TTL timestamp + INTERVAL 30 DAY"
exec_sql "ALTER TABLE observations MODIFY TTL timestamp + INTERVAL 30 DAY"
exec_sql "ALTER TABLE scores       MODIFY TTL timestamp + INTERVAL 365 DAY"

echo "✓ TTL aplicado. Verificar:"
echo "  curl -u $CLICKHOUSE_USER:\$CLICKHOUSE_PASSWORD --data 'SHOW CREATE TABLE traces' $CLICKHOUSE_URL"
