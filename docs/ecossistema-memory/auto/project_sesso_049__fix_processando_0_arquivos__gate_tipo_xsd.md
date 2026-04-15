---
name: Sessão 049 — Fix "Processando 0 arquivos" + gate tipo_xsd
description: Sessão 049 — Fix "Processando 0 arquivos" + gate tipo_xsd
type: project
project: erp
tags: ["gate", "fix", "comprobatorios", "sessao-049"]
success_score: 0.9
supabase_id: 1efc9823-ccb2-40b2-ab99-670a2e31520e
created_at: 2026-04-13 09:24:44.925893+00
updated_at: 2026-04-13 18:06:09.84713+00
---

Commits 5d7b4ef + eb5561b (11/04/2026). Bug 1: Tela 2 mostrava "Processando 0 arquivos" — modo lite retornava arquivos:[] em vez do JSONB real. Fix: arquivos: sessao.arquivos ?? []. Campo arquivos é leve (~1KB), o pesado é dados_extraidos. Bug 2: sidebar 4/4 confirmados mas gate bloqueava — handleConfirmarComprobatorio atualizava Map confirmacoes in-memory sem refletir tipo_xsd nos arquivosClassif. Fix: useMemo arquivosComConfirmacoes que mescla arquivosClassif com confirmações por nome_original, setando tipo_xsd + destino_xml:true. How to apply: campos editados in-memory E persistidos no banco devem ter serialização verificada no auto-save e flush pré-converter.
