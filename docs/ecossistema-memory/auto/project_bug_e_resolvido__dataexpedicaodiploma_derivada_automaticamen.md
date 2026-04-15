---
name: Bug #E resolvido — DataExpedicaoDiploma derivada automaticamente no builder
description: Bug #E resolvido — DataExpedicaoDiploma derivada automaticamente no builder
type: project
project: erp
tags: ["motor-xml", "bug-e", "data-expedicao", "typescript"]
success_score: 0.9
supabase_id: 414a1121-c2c3-47de-9100-1eedc1a15d87
created_at: 2026-04-13 09:19:20.356428+00
updated_at: 2026-04-13 16:05:44.100741+00
---

Fix definitivo do Bug #E (07/04/2026, commit 24755f2, deploy READY). O que mudou: helper gerarDataExpedicaoXML() em src/lib/xml/builders/base.builder.ts retorna data atual no fuso America/Sao_Paulo via Intl.DateTimeFormat (servidor Vercel roda UTC). historico.builder.ts chama helper diretamente sem ler do payload. Removido data_expedicao de DadosDiploma.diploma e data_expedicao_diploma de historico.situacao_discente em tipos.ts. TypeScript agora bloqueia compile-time qualquer chamador que tente passar esses campos.
