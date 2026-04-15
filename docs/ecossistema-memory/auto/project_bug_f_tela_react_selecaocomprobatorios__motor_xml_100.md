---
name: Bug #F tela React SelecaoComprobatorios + motor XML 100%
description: Bug #F tela React SelecaoComprobatorios + motor XML 100%
type: project
project: erp
tags: ["motor-xml", "react", "bug-f", "comprobatorios"]
success_score: 0.88
supabase_id: 554e2730-00f3-47fe-b793-b6fe1c086762
created_at: 2026-04-13 09:25:59.657012+00
updated_at: 2026-04-13 19:06:22.763162+00
---

Bug #F finalizado 07/04/2026. Motor XML 12/12 (100%). Arquivos: gerar-xml route (fix #1 auditoria override + fix #7 sem doc_academica vazio no override 0-docs); exemplo-uso.ts mock atualizado shape PdfAResult; SelecaoComprobatorios.tsx criado 700 linhas (Tailwind+lucide, grid CardArquivo, StatusPdfA, DialogSelecao com tipo_xsd+observação+metadata). Commit pendente por .git/index.lock (bindfs delete-deny) — Marcelo deve rodar rm .git/index.lock no host Mac. Não aplicados: fix #2 race condition delete+insert xml_gerados, fix #3 dead code, fix #6 Sentry. How to apply: commit mensagem pronta em memória. Próximos passos: commit+push, Job Trigger.dev backup R2, testes unit+integração+XSD, deploy.
