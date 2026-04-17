#!/usr/bin/env bash
# bootstrap.sh — primeira carga do Langfuse self-host
#
# Uso:
#   ./scripts/bootstrap.sh            (dev local via docker compose)
#   ./scripts/bootstrap.sh --railway  (modo Railway — só gera secrets e imprime)
#
# O que faz:
#   1. Gera secrets (openssl) se .env não existir
#   2. Imprime ENCRYPTION_KEY destacada (usuário salva em Vault)
#   3. Em modo local: sobe docker compose + aguarda health + mostra URL
#   4. Em modo Railway: só imprime o .env para colar nas Variables

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

MODE="local"
if [[ "${1:-}" == "--railway" ]]; then
  MODE="railway"
fi

echo "▶ Langfuse bootstrap — modo: $MODE"
echo "▶ Root: $ROOT_DIR"

# ---------------------------------------------------------------
# 1. Gerar secrets se .env não existir
# ---------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  echo "▶ .env não existe — gerando secrets..."

  # Senhas de DB → hex (URL-safe — Postgres/Redis/ClickHouse URIs não aceitam /,+,=)
  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  CLICKHOUSE_PASSWORD=$(openssl rand -hex 24)
  REDIS_PASSWORD=$(openssl rand -hex 24)
  # Secrets em env vars (não em URIs) → base64 é ok
  NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
  SALT=$(openssl rand -base64 32 | tr -d '\n')
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  OWNER_PASSWORD=$(openssl rand -base64 18 | tr -d '\n/=+' | cut -c1-20)

  cat > "$ENV_FILE" <<EOF
# Gerado por bootstrap.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ)
# NÃO COMMITAR. Este arquivo contém segredos vivos.

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
SALT=$SALT
ENCRYPTION_KEY=$ENCRYPTION_KEY

OWNER_EMAIL=marcelo@ecossistema.local
OWNER_PASSWORD=$OWNER_PASSWORD
EOF
  chmod 600 "$ENV_FILE"
  echo "▶ .env criado (chmod 600)."

  # Destacar ENCRYPTION_KEY para o Marcelo salvar em Vault
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ⚠️  BACKUP OBRIGATÓRIO DESTA CHAVE                          ║"
  echo "║  Salve AGORA em Supabase Vault + 1Password.                  ║"
  echo "║  Perdeu = dados cifrados viram inacessíveis (sem recovery).  ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
  echo ""
  echo "OWNER_PASSWORD (inicial, trocar após 1º login):"
  echo "  $OWNER_PASSWORD"
  echo ""
  read -r -p "▶ Pressione ENTER depois de salvar no Vault... "
else
  echo "▶ .env já existe — pulando geração de secrets."
fi

# ---------------------------------------------------------------
# 2. Railway mode — imprime e sai
# ---------------------------------------------------------------
if [[ "$MODE" == "railway" ]]; then
  echo ""
  echo "▶ Modo Railway — conteúdo do .env para colar em Railway Variables:"
  echo "────────────────────────────────────────────────────────────────"
  cat "$ENV_FILE"
  echo "────────────────────────────────────────────────────────────────"
  echo ""
  echo "▶ Próximos passos:"
  echo "   1. Criar projeto 'ecossistema-obs' no Railway"
  echo "   2. Adicionar 5 services (ver railway/*.json)"
  echo "   3. Colar vars em cada service (só as que 'required_env' pede)"
  echo "   4. Gerar domínio langfuse.ecossistema.* no service 'web'"
  echo "   5. Aguardar ~3-5 min para migrations rodarem"
  echo "   6. Acessar UI, logar com OWNER_EMAIL/OWNER_PASSWORD"
  echo "   7. Rodar scripts/create-api-keys.ts"
  exit 0
fi

# ---------------------------------------------------------------
# 3. Local mode — docker compose
# ---------------------------------------------------------------
cd "$ROOT_DIR"

echo "▶ Subindo stack via docker compose..."
docker compose up -d

echo "▶ Aguardando health de todos os serviços (até 2 min)..."
for i in {1..24}; do
  if docker compose ps --format json | grep -q '"Health":"healthy"'; then
    HEALTHY_COUNT=$(docker compose ps --format json | grep -c '"Health":"healthy"' || true)
    TOTAL=$(docker compose ps --format json | grep -c '"Service":' || true)
    echo "   $HEALTHY_COUNT/$TOTAL healthy..."
    if [[ "$HEALTHY_COUNT" -ge 3 ]]; then
      break
    fi
  fi
  sleep 5
done

echo ""
echo "▶ Verificando web endpoint..."
for i in {1..12}; do
  if curl -sf http://localhost:3000/api/public/health >/dev/null; then
    echo "✓ Langfuse respondendo."
    break
  fi
  sleep 5
done

echo ""
echo "▶ Pronto. Acesse:"
echo "   UI:     http://localhost:3000"
echo "   Email:  $(grep ^OWNER_EMAIL "$ENV_FILE" | cut -d= -f2)"
echo "   Senha:  (ver .env → OWNER_PASSWORD)"
echo ""
echo "▶ Próximo: scripts/create-api-keys.ts (gera keys per-business)"
