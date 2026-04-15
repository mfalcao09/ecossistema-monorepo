# Runbook: Migração de projetos Vercel para o monorepo

> **Status:** Pendente — executar APÓS push do monorepo para GitHub
> **Autor:** Claudinho + Marcelo | **Data:** 2026-04-15

## Pré-requisitos

- [ ] Monorepo `mfalcao09/ecossistema-monorepo` criado e pushado no GitHub
- [ ] Marcelo com acesso admin ao Vercel Dashboard

---

## 1. Intentus (Risco: MÉDIO | Tempo: 1-2h)

**O que está no ar:** Vite SPA no Vercel + 133 Edge Functions no Supabase

**Passos:**

1. **Vercel Dashboard → New Project**
   - Import Git Repository: `mfalcao09/ecossistema-monorepo`
   - Root Directory: `apps/intentus`
   - Framework Preset: Vite
   - Build Command: `vite build` (default)
   - Output Directory: `dist` (default)

2. **Environment Variables**
   - Copiar TODAS as env vars do projeto Vercel antigo (Intentus)
   - Incluir: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, todas as `VITE_*`

3. **Deploy Preview**
   - Verificar: SPA carrega, login funciona, mapas renderizam, dados carregam

4. **Domínio de produção**
   - Se houver custom domain: Vercel Dashboard → Domains → mover para novo projeto
   - Se usar *.vercel.app: anotar nova URL

5. **Burn-in: 24-48h**
   - Monitorar logs no Vercel Dashboard

6. **Pós-validação:**
   - Arquivar `mfalcao09/intentus-plataform` no GitHub
   - ⚠️ As 133 Edge Functions do Supabase NÃO são afetadas por nada disso

---

## 2. ERP-Educacional (Risco: ALTO | Tempo: 2-4h)

**O que está no ar:** Next.js 15 + 7 Vercel Crons + 6 Python APIs + Supabase DB

**Passos:**

1. **Vercel Dashboard → New Project**
   - Import Git Repository: `mfalcao09/ecossistema-monorepo`
   - Root Directory: `apps/erp-educacional`
   - Framework Preset: Next.js
   - Build Command: `next build` (default)

2. **Environment Variables** (COPIAR TODAS — lista mínima):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Todas as `INTER_*` (API Banco Inter — boletos, PIX)
   - `BRY_*` (assinatura digital)
   - `CRYPTO_*` (chaves de criptografia PII)
   - `CRON_SECRET` (se houver — protege endpoints de cron)
   - **NÃO ESQUECER NENHUMA** — uma env faltando = cron financeiro falha silenciosamente

3. **Verificar vercel.json**
   - O arquivo `apps/erp-educacional/vercel.json` DEVE conter os 7 crons
   - Vercel lê automaticamente do Root Directory

4. **Deploy Preview → Checklist:**
   - [ ] Frontend carrega (página de login)
   - [ ] Login com credenciais funciona
   - [ ] Listagem de diplomas OK (SELECT na tabela `diplomas`)
   - [ ] Menu de módulos funciona
   - [ ] `/api/financeiro/emit-boletos` responde (GET → deve retornar 405 ou mensagem, NÃO 500)
   - [ ] Verificar no Vercel Dashboard → Crons que os 7 crons aparecem

5. **Trocar domínio de produção**
   - Vercel Dashboard → projeto antigo → Domains → remover custom domain
   - Vercel Dashboard → projeto novo → Domains → adicionar mesmo domain
   - DNS propaga em < 5 minutos (Vercel gerencia)

6. **Burn-in: 48h (MÍNIMO)**
   - Deve cobrir pelo menos 1 execução de cada cron:
     - [x] lgpd-purge (2am)
     - [x] backup (3am)
     - [x] cron-inadimplencia (8am)
     - [x] cron-regua (8am)
     - [x] cron-expirar-pix (0:01)
     - [ ] key-rotation (domingo 3am — pode levar até 7 dias)
     - [ ] emit-boletos (dia 20 — só 1x por mês)
   - Monitorar Vercel Dashboard → Logs → Crons

7. **Pós-validação:**
   - Arquivar `mfalcao09/diploma-digital` no GitHub
   - Remover projeto Vercel antigo (só após 7+ dias sem incidentes)

---

## Rede de segurança

- **Rollback rápido:** Se o novo projeto falhar, reativar o antigo:
  1. Remover custom domain do novo projeto
  2. Adicionar de volta ao projeto antigo
  3. Tempo: < 5 minutos

- **Edge Functions Supabase:** NÃO são afetadas por nada acima. Deploy de EFs é via `supabase functions deploy`, independente do GitHub.

- **Banco de dados:** Supabase DBs continuam intactos. Nenhuma migração de dados necessária.
