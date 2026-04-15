---
name: Sessão 053 — Epic 1.1 PII Crypto entregue + migração completa
description: Sprint 1 Epic 1.1 completo — RPCs hash_cpf/encrypt_pii/decrypt_pii + 4 rotas migradas + migração 158/158 diplomados executada + env vars configuradas
type: project
---

## Sessão 053 (11/04/2026) — Epic 1.1 PII Crypto

**Commits:**
- `48006a4` — feat(security): Epic 1.1 PII Crypto — HMAC-SHA256 + AES-256
- `a4b263e` — fix(middleware): bypass auth para /api/admin/ + docs masterplan v4 e sprints
- `50b9029` — fix(pii): migração usa service_role para bypass RLS
- `072a78a` — fix(pii): coluna correta rg_numero (não rg) na migração

**Deploy:** Vercel READY em produção

### O que foi feito

1. **3 RPCs Supabase criadas e testadas:**
   - `hash_cpf(cpf_raw, salt)` → HMAC-SHA256, IMMUTABLE
   - `encrypt_pii(plaintext, encryption_key)` → AES-256 pgp_sym_encrypt, VOLATILE
   - `decrypt_pii(encrypted_data, encryption_key)` → base64→decrypt, STABLE
   - **search_path = public, extensions** (pgcrypto está no schema `extensions` no Supabase)

2. **4 colunas em diplomados:** cpf_hash, cpf_encrypted, email_encrypted, rg_encrypted + 2 índices parciais

3. **4 rotas API migradas** para cpf_hash com try/catch fallback plaintext:
   - `src/app/api/diplomados/route.ts` — busca por CPF removida do search text
   - `src/app/api/portal/consultar-cpf/route.ts` — lookup por hash
   - `src/app/api/processos/route.ts` — encontrar diplomado existente por hash
   - `src/lib/security/lgpd.ts` — relatório DSAR por hash

4. **Rota admin:** POST /api/admin/migrar-pii (protegida por ADMIN_SECRET)

5. **Env vars Vercel:**
   - `PII_ENCRYPTION_KEY` — já existia (Mar 23, Sensitive, Production+Preview)
   - `ADMIN_SECRET` — adicionada via browser (All Environments)

6. **Migração PII executada com sucesso:**
   - 158/158 diplomados com cpf_hash ✅
   - 158/158 com cpf_encrypted ✅
   - 157/158 com rg_encrypted (1 sem RG) ✅
   - 0 com email_encrypted (nenhum tinha email cadastrado)

7. **Docs de planejamento commitados:**
   - memory/masterplans/diploma-digital-v4.md
   - memory/sprints/sprint-1-seguranca.md até sprint-6-observabilidade.md
   - memory/PENDENCIAS.md e memory/TRACKER.md

### Problemas encontrados e resolvidos
- `search_path = public` não encontrava `hmac()` → corrigido para `public, extensions`
- `security_events.risco` check constraint: valores válidos são `baixo/medio/alto/critico`
- `security_events.ip` NOT NULL → usado `0.0.0.0` para audit da migration
- encrypt_pii retornava bytea mas coluna é TEXT → encode/decode base64
- git reset --hard apagou arquivos editados (mount = diretório real) → recriados
- Disco /tmp cheio (FUSE) → usado Desktop Commander para commit+push no Mac
- Middleware bloqueava /api/admin/ (exigia sessão Supabase) → adicionado ao PUBLIC_PREFIXES
- migrarCriptografiaDiplomados usava createClient() (RLS) → trocado por service_role
- Coluna `rg` não existe em diplomados → corrigido para `rg_numero`
- Mac path é `/Users/marcelosilva/Projects/GitHub/ERP-Educacional` (não /Users/marcelo/GitHub/)

### Próximo
- Epic 1.2 Vault (env vars centralizadas)
- Epic 1.3 Railway Security
- Epic 1.4 Hard Lock
