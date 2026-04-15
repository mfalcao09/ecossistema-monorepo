---
name: Sessão 044 — Prompt revisado + inserção manual comprobatórios
description: Sessão 044 — Prompt revisado + inserção manual comprobatórios
type: project
project: erp
tags: ["gemini", "comprobatorios", "manual", "sessao-044"]
success_score: 0.88
supabase_id: 3591fb23-cb5c-4461-978f-c533317f97fa
created_at: 2026-04-13 09:24:10.156184+00
updated_at: 2026-04-13 18:06:06.207962+00
---

Commit 30e2d51 (10/04/2026). Problema: 0% confiança + 1/4 detectados. Causas: prompt vago + || 0 zerando confiança + filtro !== outro descartando docs. Fix extractor.js: tabela fixa 14 tipos válidos (case-sensitive), confiança 0.05-1.0 obrigatória (nunca null/0), passo-a-passo classificar→extrair→confiar. Fix server.js: typeof=== number para confianca_geral; fallback ?? outro; agregarDados não filtra mais outro. Novo DialogSelecionarArquivo.tsx: picker manual de arquivo com ícones MIME, detecta se já vinculado, cria confirmação detectado. Mapa expandido +20 variações (CIN, CNH, e-Título etc). How to apply: mapa-comprobatorios.ts é fonte de verdade para matching Gemini→XSD.
