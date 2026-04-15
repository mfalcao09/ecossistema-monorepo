---
name: Sessão 033 — DB Write Direto (eliminação do callback HTTP Railway→Next.js)
description: Refatoramento arquitetural em 09/04/2026 que elimina o canal HTTP callback (3 bugs consecutivos) fazendo o Railway gravar direto em extracao_sessoes via service_role
type: project
---

**Sessão 033 (09/04/2026) — Refatoramento "DB Write Direto" Etapa 1**

Commit: `3bccb3c599c0e3d0c7e3054ee709c2fb5ad1e0a4`
Deploy: `dpl_Buw6YCwWtnUAEisYEAJXMP6djnDt` READY (aliases gestao + diploma, build ~80s)

**Why:** o canal HTTP callback Railway → Next.js (PUT `/api/extracao/sessoes/[id]/callback`) sofreu 3 bugs em sessões consecutivas — 031 (timeout Tela 2), 032 (307 middleware), e histórico de race no nonce. Cada bug deixava sessões órfãs silenciosas. Marcelo pediu **"solução definitiva"** e aprovou "Opção 1 e 2, em etapas, sequencial" + "VAi".

**Como ficou (Etapa 1):**
- Railway tem novo módulo `services/document-converter/src/supabase-writer.js` que escreve direto em `extracao_sessoes` via service_role
- UPDATE atômico idempotente `WHERE id=? AND status='processando'` — não sobrescreve revisão humana nem reprocesso
- Contrato preservado exatamente: `status='rascunho'` + `version=2` (frontend polling não precisa mudar)
- `server.js` perdeu `enviarCallback`, `isCallbackUrlAllowed`, `EXTRACAO_CALLBACK_SECRET`, `CALLBACK_ALLOWED_HOSTS`
- `/api/extracao/iniciar` não envia mais `callback_url` nem header `x-extracao-callback-secret`
- `/api/extracao/sessoes/[id]/callback` virou **410 Gone** (para diagnóstico durante rolling deploy)
- `gerarCallbackNonce` ainda é chamado no /iniciar e gravado em `callback_nonce` — harmless (vira identificador que o writer marca `callback_nonce_used_at`)

**Requisito de produção:** Railway precisa das env vars
- `SUPABASE_URL=https://ifdnjieklngcfodmtied.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service_role do projeto ifdnjieklngcfodmtied>`

Sem elas, o writer lança exception e a sessão fica em `processando` até o TTL de 15min do /iniciar limpar.

**How to apply:**
- Debug de extração que trava: não procurar mais por callback HTTP — olhar logs do Railway (`[db-writer]`) e `extracao_sessoes.erro_mensagem`
- Frontend polling continua igual (status rascunho + version 2)
- Etapa 2 (próxima): habilitar Supabase Realtime em `extracao_sessoes` e fazer Tela 2 consumir via subscribe, com polling como fallback
