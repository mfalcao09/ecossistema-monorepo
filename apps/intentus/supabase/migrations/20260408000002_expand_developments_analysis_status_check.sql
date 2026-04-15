-- Sessão 130 — fix bug de criação de rascunho do wizard de Parcelamento.
--
-- Sintoma: ao concluir o Step 2 do NovoProjetoDialog, o frontend recebia
-- "new row violates row-level security policy for table 'developments'".
--
-- Root cause: a CHECK constraint developments_analysis_status_check só
-- aceitava valores em INGLÊS (pending/geo_analyzing/geo_done/financial_done/
-- legal_done/complete/error), mas:
--   • o frontend (types.ts AnalysisStatus) usa valores em PORTUGUÊS
--     (rascunho, em_analise, pendente, em_processamento, concluido, erro);
--   • EFs como registry-ocr-ai e n8n-webhook-return também gravam em PT;
--   • EFs como development-elevation ainda gravam em EN (legacy).
--
-- O Postgres levantava 23514 (check constraint), mas o Postgrest do Supabase
-- mascarou a mensagem como erro de RLS no payload do cliente, dificultando
-- o diagnóstico.
--
-- Fix backward-compatible: AMPLIA a CHECK pra aceitar AMBOS os conjuntos
-- (legacy EN + atual PT) — não quebra nenhuma EF antiga e desbloqueia o
-- wizard novo.

ALTER TABLE public.developments
  DROP CONSTRAINT IF EXISTS developments_analysis_status_check;

ALTER TABLE public.developments
  ADD CONSTRAINT developments_analysis_status_check
  CHECK (analysis_status = ANY (ARRAY[
    -- Legacy (inglês) — usados por development-elevation e migrations antigas
    'pending'::text,
    'geo_analyzing'::text,
    'geo_done'::text,
    'financial_done'::text,
    'legal_done'::text,
    'complete'::text,
    'error'::text,
    -- Português — usados pelo frontend, EFs novas e wizard de parcelamento
    'rascunho'::text,
    'em_analise'::text,
    'pendente'::text,
    'em_processamento'::text,
    'concluido'::text,
    'erro'::text
  ]));
