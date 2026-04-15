---
name: Sprint 2 Etapa 2 UI drag-drop + polling em produção
description: Sessão 030 (08/04/2026) — Tela 1 (react-dropzone) + Tela 2 (polling) + bucket processo-arquivos. Loop UI completo Tela 1 → Storage → API → Railway → callback → polling → Tela 2. Commit 5e5e2e9, deploy READY
type: project
---

Sessão 030 — Sprint 2 Etapa 2 entregue em produção (commit `5e5e2e9`, deploy `dpl_BPMjCcZH8v6kkeD7Uu3ce2TCdNtZ` READY ~80s).

**Why:** fechar o lado UI do loop de extração IA aberto na sessão 029 (Etapas 1.1 + 1.2 do backend).

**How to apply:**
- Lib drag-drop padrão do ERP: **react-dropzone v15** (headless, ~10KB, acessível). Tipar callback com `FileRejection[]` (readonly).
- Upload **client-side direto** pro Supabase Storage (anon key + JWT). Path `{userId}/{ts}-{nome-sanitizado}`. Evita o limite de 4.5 MB do Vercel.
- Cleanup best-effort de órfãos: `storage.remove(pathsUploadados)` em catch do upload chunked.
- Polling padrão: `ativo` ref + re-check `ativo.current` pós-await + `statusRef` pra parar intervalo + `ativo.current=false` antes de clearInterval no timeout.
- GET de polling: whitelist `SELECT_PUBLICO` (sem `callback_nonce*`) + `.eq('usuario_id', userId)` + `force-dynamic`.

**Próximo passo:** Sprint 2 Etapa 3 — formulário pré-preenchido com `dados_extraidos`, gate FIC (4 comprobatórios), classificação dos arquivos pelos 3 destinos (XML / Acervo / só processo).
