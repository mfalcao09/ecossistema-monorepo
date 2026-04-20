#!/usr/bin/env bash
# P-010 — Deploy das Edge Functions do Magic Link Vault
# Ref: packages/magic-link-vault/server/edge-function/
# Requer: supabase CLI autenticado + SUPABASE_PROJECT_REF setado

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-gqckbunsfjgerbuiyzvn}"
EF_DIR="$(cd "$(dirname "$0")/../server/edge-function" && pwd)"

echo "=== Magic Link Vault — Deploy Edge Functions ==="
echo "Projeto: $PROJECT_REF"
echo "Fonte:   $EF_DIR"
echo ""

# Verifica supabase CLI
if ! command -v supabase &>/dev/null; then
  echo "❌ supabase CLI não encontrado. Instale via: brew install supabase/tap/supabase"
  exit 1
fi

# Deploy collect-secret
echo "📦 Deployando collect-secret..."
supabase functions deploy collect-secret \
  --project-ref "$PROJECT_REF" \
  --import-map "$EF_DIR/collect-secret/deno.json" 2>/dev/null || \
supabase functions deploy collect-secret \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "✅ collect-secret deployed"

# Deploy retrieve-secret
echo "📦 Deployando retrieve-secret..."
supabase functions deploy retrieve-secret \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "✅ retrieve-secret deployed"

# Deploy vault-create-token (helper para collect-secret-tool.ts)
echo "📦 Deployando vault-create-token..."
supabase functions deploy vault-create-token \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "✅ vault-create-token deployed"

echo ""
echo "=== Deploy concluído ==="
echo ""
echo "⚠️  Verificar no Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/functions"
echo ""
echo "⚠️  Secrets obrigatórios (já setados via P-009/P-015):"
echo "   VAULT_KEK_HEX    — 256 bits hex"
echo "   VAULT_BASE_URL   — URL base do vault UI"
