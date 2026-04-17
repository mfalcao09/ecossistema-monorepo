#!/usr/bin/env bash
# Smoke test — 5 EFs Dia 2 (S8)
# Uso:
#   EF_BASE="https://gqckbunsfjgerbuiyzvn.functions.supabase.co" \
#   OWNER_TOKEN="<owner token em plaintext>" \
#   ./scripts/smoke-test-efs.sh
set -euo pipefail

EF_BASE="${EF_BASE:-https://gqckbunsfjgerbuiyzvn.functions.supabase.co}"
OWNER_TOKEN="${OWNER_TOKEN:-}"

if [ -z "$OWNER_TOKEN" ]; then
  echo "ERROR: OWNER_TOKEN env var required" >&2
  exit 1
fi

pass=0; fail=0
check() {
  local name="$1"; shift
  local expected_status="$1"; shift
  local actual
  actual=$("$@" -o /tmp/ef-body.$$ -w '%{http_code}' -s)
  if [ "$actual" = "$expected_status" ]; then
    echo "  ✓ $name — HTTP $actual"
    pass=$((pass+1))
  else
    echo "  ✗ $name — expected $expected_status, got $actual" >&2
    cat /tmp/ef-body.$$ >&2 || true
    echo >&2
    fail=$((fail+1))
  fi
  rm -f /tmp/ef-body.$$
}

auth_h=(-H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json")

echo "→ pii-mask"
check "mask CPF+email+phone" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/pii-mask" \
  -d '{"text":"CPF 123.456.789-00, email joao@test.com, fone (11) 99999-8888"}'
check "batch input" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/pii-mask" -d '{"texts":["a@b.com","CNPJ 12.345.678/0001-90"]}'
check "bad request" 400 curl "${auth_h[@]}" -X POST "$EF_BASE/pii-mask" -d '{}'

echo "→ skills-registry-crud"
check "match existing" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/skills-registry-crud/match" \
  -d '{"query":"test","business_id":"ecosystem","limit":3}'
check "list" 200 curl "${auth_h[@]}" \
  "$EF_BASE/skills-registry-crud?business_id=ecosystem&active=true"
check "unauthorized" 401 curl -H "Content-Type: application/json" \
  "$EF_BASE/skills-registry-crud"

echo "→ credential-gateway-v2"
check "validate existing" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/credential-gateway-v2/validate" \
  -d '{"credential_name":"GITHUB_TOKEN_ECOSSISTEMA","project":"ecosystem"}'
check "not found" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/credential-gateway-v2/validate" \
  -d '{"credential_name":"__DOES_NOT_EXIST__","project":"ecosystem"}'
check "list" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/credential-gateway-v2/list" -d '{}'

echo "→ webhook-hardening"
# Sem provider configurado → 404
check "unknown provider → 404" 404 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/webhook-hardening/__unknown__" -d '{"event":"test"}'

echo "→ dual-write-pipeline"
IDEM_KEY="smoke-$(date +%s)-$RANDOM"
# Primary em tabela que aceita JSON livre — usar agent_tasks (insert)
check "dual write insert" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/dual-write-pipeline" \
  -d "{\"pipeline_id\":\"smoke\",\"idempotency_key\":\"$IDEM_KEY\",\"primary\":{\"project\":\"ecosystem\",\"table\":\"dual_write_log\",\"op\":\"insert\",\"payload\":{\"idempotency_key\":\"inner-$IDEM_KEY\",\"pipeline_id\":\"smoke-inner\",\"primary_project\":\"ecosystem\",\"primary_table\":\"noop\",\"primary_status\":\"ok\"}}}"
check "idempotent replay" 200 curl "${auth_h[@]}" \
  -X POST "$EF_BASE/dual-write-pipeline" \
  -d "{\"pipeline_id\":\"smoke\",\"idempotency_key\":\"$IDEM_KEY\",\"primary\":{\"project\":\"ecosystem\",\"table\":\"dual_write_log\",\"op\":\"insert\",\"payload\":{}}}"

echo
echo "================================================="
echo "  Passed: $pass   Failed: $fail"
echo "================================================="
if [ "$fail" -gt 0 ]; then exit 1; fi
