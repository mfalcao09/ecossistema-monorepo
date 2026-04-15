---
name: Pipeline pós-assinatura BRy: finalize → carimbo síncrono → aguardando registradora
description: Pipeline pós-assinatura BRy: finalize → carimbo síncrono → aguardando registradora
type: project
project: erp
tags: ["bry", "pipeline", "assinatura", "carimbo", "registradora"]
success_score: 0.9
supabase_id: a7762452-1ae6-48de-8dde-b80e37035dbe
created_at: 2026-04-13 09:18:51.793075+00
updated_at: 2026-04-13 15:05:41.50963+00
---

Pipeline completo (sessão 082, commits 613f151 + df83975): 1) Última assinatura AD-RA via BRy Signer → finalize/route.ts, 2) Upload XML assinado para storage xml-diplomas/assinado/{id}/, 3) Auto-carimbo SÍNCRONO (não fire-and-forget) via aplicarCarimboXmlInterno() com XML já em memória, 4) Se todos XMLs carimbados → verificarEAvancarPacote() → status aguardando_envio_registradora, 5) POST /api/diplomas/[id]/pacote-registradora → ZIP com XMLs assinados + .p7s carimbo + PDFs/A + manifest.json v1.1. Por que síncrono: Vercel serverless corta execução após response.
