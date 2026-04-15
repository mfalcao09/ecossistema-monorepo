---
name: Hardening RLS Sessão 028 — 5 achados fechados
description: Hardening RLS Sessão 028 — 5 achados fechados
type: project
project: erp
tags: ["rls", "seguranca", "migration", "sessao-028"]
success_score: 0.9
supabase_id: 77e3445f-15c8-4bee-809d-6c716e2509e6
created_at: 2026-04-13 09:22:03.410397+00
updated_at: 2026-04-13 16:05:50.790621+00
---

Hardening RLS 08/04/2026 commit b0a38d7, deploy dpl_4nVQ READY. Achados fechados: ERROR rls_disabled_in_public em processo_arquivos; WARN rls_policy_always_true em extracao_sessoes e diploma_documentos_comprobatorios (4 policies); WARN function_search_path_mutable em update_processo_arquivos_updated_at. Estado final: processo_arquivos RLS ON + policy auth.uid() IS NOT NULL; extracao_sessoes policy atualizada; diploma_documentos_comprobatorios 4 policies SELECT/INSERT/UPDATE/DELETE com auth.uid(); trigger com SET search_path = public, pg_temp. How to apply: modelo single-tenant FIC — authenticated tem acesso total, anon não tem acesso. Novas tabelas nascem RLS ON + auth.uid() IS NOT NULL. Nunca aceitar USING(true).
