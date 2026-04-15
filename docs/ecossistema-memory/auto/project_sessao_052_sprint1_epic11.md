---
name: Sessão 052 — Sprint 1 Epic 1.1 PII Crypto
description: MASTERPLAN v4 iniciado. Migration PII crypto (HMAC-SHA256 + AES-256), 4 rotas migradas para cpf_hash, rota admin migrar-pii, regra rastreabilidade sprints
type: project
---

## Sessão 052 (11/04/2026): Sprint 1 Epic 1.1 — PII Crypto

### O que foi feito
1. **MASTERPLAN v4 atualizado** com regra de rastreabilidade obrigatória (3 artefatos por sprint: masterplan → plano → executado)
2. **`sprints/SPRINT-1-PLANO.md` criado** — plano detalhado dos 4 Epics do Sprint 1
3. **Migration SQL criada** (`20260411_pii_crypto_activate.sql`):
   - 3 RPCs: `hash_cpf` (HMAC-SHA256), `encrypt_pii` (pgp_sym_encrypt AES-256), `decrypt_pii`
   - 4 colunas em `diplomados`: cpf_hash, cpf_encrypted, email_encrypted, rg_encrypted
   - 2 índices parciais em cpf_hash
4. **4 rotas API migradas** para usar cpf_hash com fallback plaintext:
   - `api/portal/consultar-cpf/route.ts`
   - `api/processos/route.ts`
   - `api/diplomados/route.ts`
   - `lib/security/lgpd.ts`
5. **Rota admin temporária** `POST /api/admin/migrar-pii` — migra dados existentes em lotes de 100
6. **TypeScript compilation** — zero erros (`tsc --noEmit` limpo)

### Correções pós-review (auto-identificadas)
- `encrypt_pii` mudada de IMMUTABLE para VOLATILE (IV aleatório)
- `decrypt_pii` mudada de IMMUTABLE para STABLE
- encrypt agora faz `encode(..., 'base64')` para armazenar em coluna TEXT
- decrypt agora faz `decode(encrypted_data, 'base64')` antes do pgp_sym_decrypt

### Arquivos criados/modificados
| Arquivo | Ação |
|---------|------|
| `MASTERPLAN-REVISADO-v4.md` | Editado — regra rastreabilidade adicionada |
| `sprints/SPRINT-1-PLANO.md` | Criado — plano Sprint 1 completo |
| `supabase/migrations/20260411_pii_crypto_activate.sql` | Criado — RPCs + colunas + índices |
| `src/app/api/admin/migrar-pii/route.ts` | Criado — rota temporária migração |
| `src/app/api/portal/consultar-cpf/route.ts` | Editado — cpf_hash com fallback |
| `src/app/api/processos/route.ts` | Editado — cpf_hash com fallback |
| `src/app/api/diplomados/route.ts` | Editado — removeu cpf do search, busca por hash |
| `src/lib/security/lgpd.ts` | Editado — cpf_hash com fallback |

### Pendências para próxima sessão
1. **Executar migration no Supabase** (SQL Editor)
2. **Configurar PII_ENCRYPTION_KEY** em Vercel + Railway env vars
3. **Executar migração de dados** via `POST /api/admin/migrar-pii`
4. **Commit + push + deploy** (padrão /tmp clone)
5. **Epic 1.2** (Vault), **1.3** (Railway Security), **1.4** (Hard Lock)

### Squad utilizado
- DeepSeek: consultado sobre RPCs pgcrypto (HMAC-SHA256 vs digest, pgp_sym_encrypt)
- Buchecha/MiniMax: code review solicitado (em andamento)

**Why:** Primeiro passo do MASTERPLAN v4 — blindar PII antes de qualquer outro trabalho.
**How to apply:** Migration precisa ser executada no Supabase antes do deploy. PII_ENCRYPTION_KEY obrigatória.
