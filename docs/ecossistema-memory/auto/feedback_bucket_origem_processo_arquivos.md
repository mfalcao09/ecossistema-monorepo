---
name: feedback_bucket_origem_processo_arquivos
description: Arquivos de processo do ERP vivem em 'processo-arquivos', não em 'documentos' — BUCKET_ORIGEM confirmado
type: feedback
---

Arquivos de `processo_arquivos` (comprobatórios de diploma) ficam no bucket `processo-arquivos` no Supabase Storage. O bucket `documentos` retorna 404 para esses paths.

**Why:** O `converter-service.ts` foi criado com `BUCKET_ORIGEM = 'documentos'` mas a rota de upload `/api/processos/[id]/arquivos` usa o bucket `processo-arquivos`. A divergência causava 404 silencioso → PdfAConversionError → 502 em toda tentativa de Gerar XML.

**How to apply:** Sempre que houver código que faz `admin.storage.from('documentos').download(arquivo.storage_path)` para arquivos de `processo_arquivos`, corrigir para `from('processo-arquivos')`. Confirmar via curl antes de deploy.
