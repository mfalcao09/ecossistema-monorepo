---
name: Sprint 2 Etapa 2 UI drag-drop + polling Tela 1/Tela 2
description: Sprint 2 Etapa 2 UI drag-drop + polling Tela 1/Tela 2
type: project
project: erp
tags: ["ui", "drag-drop", "polling", "sessao-030"]
success_score: 0.88
supabase_id: b774e7ef-5bc8-4764-a75c-bd94ee97768e
created_at: 2026-04-13 09:22:44.860063+00
updated_at: 2026-04-13 17:05:57.060848+00
---

Sessão 030 (08/04/2026) commit 5e5e2e9, deploy READY 80s. Tela 1 react-dropzone v15 headless + upload client-side direto Supabase Storage (anon key + JWT, path {userId}/{ts}-{nome-sanitizado}). Cleanup best-effort órfãos em catch. Tela 2 polling: ativo ref + re-check pós-await + statusRef pra parar intervalo. GET whitelist SELECT_PUBLICO sem callback_nonce. How to apply: lib padrão ERP drag-drop = react-dropzone v15. Upload client-side evita limite 4.5MB Vercel. Polling pattern: ativo.current=false antes de clearInterval no timeout.
