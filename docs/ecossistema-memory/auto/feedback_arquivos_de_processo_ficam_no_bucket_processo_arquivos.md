---
name: Arquivos de processo ficam no bucket processo-arquivos
description: Arquivos de processo ficam no bucket processo-arquivos
type: feedback
project: erp
tags: ["bucket", "storage", "supabase"]
success_score: 0.9
supabase_id: 19727d8f-ca46-413e-b178-10c2e4bf1d1b
created_at: 2026-04-13 09:13:28.773921+00
updated_at: 2026-04-13 10:04:45.295265+00
---

Arquivos de processo_arquivos (comprobatórios de diploma) ficam no bucket processo-arquivos no Supabase Storage. O bucket documentos retorna 404 para esses paths. O converter-service.ts foi criado com BUCKET_ORIGEM = documentos mas a rota de upload /api/processos/[id]/arquivos usa o bucket processo-arquivos. A divergência causava 404 silencioso → PdfAConversionError → 502 em toda tentativa de Gerar XML. Sempre que houver código que faz admin.storage.from(documentos).download(arquivo.storage_path) para arquivos de processo_arquivos, corrigir para from(processo-arquivos).
