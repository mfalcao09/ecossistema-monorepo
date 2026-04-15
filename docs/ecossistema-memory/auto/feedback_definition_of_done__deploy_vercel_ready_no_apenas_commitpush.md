---
name: Definition of Done = deploy Vercel READY (não apenas commit+push)
description: Definition of Done = deploy Vercel READY (não apenas commit+push)
type: feedback
project: erp
tags: ["vercel", "deploy", "dod", "definition-of-done"]
success_score: 0.95
supabase_id: d36e579f-e308-4b89-ae3b-3ade7e8dc941
created_at: 2026-04-13 09:13:52.723688+00
updated_at: 2026-04-13 10:04:52.518099+00
---

Commit + push NÃO é tarefa concluída. Só está encerrado quando deploy Vercel retornar READY. Ciclo: 1) git commit+push, 2) Vercel CLI vercel list para pegar URL do deploy, 3) vercel inspect <url> --wait, 4) Se Error: ler logs, corrigir, build local, commit, push, repetir. Validação pós-verde: Sentry search_issues últimos 15min + get_advisors se migration + runtime logs se tocou API. Stop conditions: 3x mesmo erro (loop) ou causa fora do alcance (secret rotacionado, env var faltando). Nota 11/04/2026: MCP Vercel perdeu conexão, Vercel CLI com $VERCEL_TOKEN substitui.
