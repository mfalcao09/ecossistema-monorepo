---
name: Supabase ECOSYSTEM vira fonte primária de verdade na Onda 2 (MARCO CRÍTICO)
description: Supabase ECOSYSTEM vira fonte primária de verdade na Onda 2 (MARCO CRÍTICO)
type: decision
project: ecosystem
tags: ["supabase-first", "onda-2", "marco-critico", "dual-write", "memoria", "v8.1"]
success_score: 0.95
supabase_id: b69ca2c0-585f-4948-8ee4-ae04b5bc56ac
created_at: 2026-04-14 08:06:49.798761+00
updated_at: 2026-04-14 08:07:09.652434+00
---

A partir da conclusão da Onda 2 do V8.1, Supabase ECOSYSTEM (gqckbunsfjgerbuiyzvn) passa a ser a fonte primária de verdade do ecossistema. Toda escrita de memória (sessão, decisão, contexto, feedback) executa INSERT no Supabase ANTES de gravar o arquivo .md local. Se Supabase falhar, a sessão não é marcada como persistida. Arquivos locais em memory/ viram cache/backup assíncrono. Skills, agentes e workers consultam Supabase como primeira opção e só recorrem ao .md em modo degradado. RTO < 15min conforme MP-07. Implementação: schema ecosystem_memory + função persist_memory() (SQL→MD ordem obrigatória) + hook em CLAUDE.md que recusa encerrar sessão sem confirmação de INSERT. claude-mem sincroniza via trigger.
