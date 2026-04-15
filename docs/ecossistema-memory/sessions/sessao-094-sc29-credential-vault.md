# Sessão 094 — SC-29: Credential Vault Agent

**Data:** 14/04/2026  
**Projeto:** Ecossistema de IA  
**Status:** ✅ COMPLETO  
**Duração estimada:** ~2h  

---

## Objetivo

Implementar SC-29 — Credential Vault Agent: mover secrets hardcoded para o Supabase Vault e criar infraestrutura centralizada de gerenciamento de credenciais.

---

## Entregas

### 1. Tabelas criadas (Supabase ECOSYSTEM `gqckbunsfjgerbuiyzvn`)

- **`ecosystem_credentials`** — Registry central de credenciais (metadados, nunca o valor)
  - Campos: id, name, service, scope, location, vault_key, description, last_rotated_at, expires_at, is_active
  - RLS ON: authenticated pode ler, service_role pode tudo

- **`credential_access_log`** — Auditoria imutável de todo acesso
  - Campos: id, credential_id, credential_name, accessed_by, action, context, success, error_msg, accessed_at
  - RLS ON: service_role pode tudo, authenticated pode ler

### 2. Supabase Vault (pgsodium)

- **`EMBED_INTERNAL_SECRET`** inserido no Vault
  - Valor: `ecosystem-embed-2026`
  - UUID no Vault: `61cf16e6-efb9-472c-8dc0-6e913b07ced0`

### 3. Trigger atualizado (sem hardcode!)

- Função `trigger_auto_embed_memory` reescrita
- Antes: `v_secret TEXT := 'ecosystem-embed-2026';` (hardcoded)
- Depois: `SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'EMBED_INTERNAL_SECRET'`
- Fallback: se Vault indisponível → `RAISE WARNING` e retorna NEW sem crashar

### 4. Edge Function `credential-agent` v1

- **URL:** `https://gqckbunsfjgerbuiyzvn.supabase.co/functions/v1/credential-agent`
- **Auth:** header `x-agent-secret` (valor em `AGENT_INTERNAL_SECRET`)
- **Endpoints:**
  - `GET ?name=X` → metadados da credencial
  - `GET ?name=X&value=1` → metadados + valor do Vault
  - `POST /` → criar/registrar credencial
  - `POST /rotate` → rotacionar secret no Vault
- **Status:** ACTIVE, verify_jwt=false

### 5. Helper RPCs (service_role only)

- `get_vault_secret(secret_name TEXT) → TEXT`
- `create_vault_secret(secret_value, secret_name, secret_description) → UUID`
- `rotate_vault_secret(secret_name, new_value) → BOOLEAN`

### 6. Registry inicial (6 credenciais)

| Nome | Serviço | Escopo | Localização |
|------|---------|--------|-------------|
| EMBED_INTERNAL_SECRET | internal | ecosystem | supabase-vault |
| GEMINI_API_KEY_ECOSYSTEM | google-ai | ecosystem | supabase-secret |
| AGENT_INTERNAL_SECRET | internal | ecosystem | supabase-secret |
| SUPABASE_SERVICE_ROLE_KEY_ECOSYSTEM | supabase | ecosystem | supabase-secret |
| SUPABASE_SERVICE_ROLE_KEY_ERP | supabase | erp | railway-env |
| SUPABASE_SERVICE_ROLE_KEY_INTENTUS | supabase | intentus | vercel-env |

### 7. Teste e2e ✅

- INSERT em ecosystem_memory → trigger disparou → leu do Vault → pg_net → embed-on-insert → Gemini → embedding 768 dims gravado
- ID de teste: `79dee70c-b44b-47f9-b649-8062e27164c4`

---

## Pendências criadas

- [ ] **P1:** Configurar `AGENT_INTERNAL_SECRET` nos Supabase Secrets (substituir o default `credential-agent-2026`)
- [ ] **P2 (próxima sessão):** Fase 0.1 — Git como fonte de verdade (push automático de `memory/`)

---

## Commit sugerido

```
feat(sc-29): credential vault agent — tabelas, vault, trigger, edge function, registry

- Cria ecosystem_credentials + credential_access_log com RLS
- EMBED_INTERNAL_SECRET no Supabase Vault (pgsodium)
- trigger_auto_embed_memory: lê do Vault, sem hardcode
- Deploy credential-agent v1 (GET/POST/rotate)
- RPCs helper: get/create/rotate_vault_secret (service_role only)
- Registry inicial: 6 credenciais catalogadas
- E2e: insert → vault → pg_net → gemini → 768 dims ✅

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Backlinks

- Masterplan: `memory/masterplans/MASTERPLAN-ECOSSISTEMA-v8.2.md` → SC-29
- Plano de implementação: `PLANO-IMPLEMENTACAO-ECOSSISTEMA-V1.md` → FASE 0.0
- Sessão anterior: `sessao-093-fase-b-auto-embed-masterplan-v8.2.md`
- Próxima sessão: Fase 0.1 — Git como fonte de verdade
