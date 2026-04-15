---
name: Railway converter-service URL de produção
description: URL real do document-converter no Railway é diploma-digital-production.up.railway.app (NÃO document-converter-production, nem converter-service)
type: reference
---

URL de produção do microserviço `services/document-converter/` no Railway:

**`https://diploma-digital-production.up.railway.app`**

Verificado em 08/04/2026 (sessão 029):
- `GET /health` → `{"status":"ok","service":"document-converter","version":"1.0.0"}`
- `POST /extrair-documentos` sem x-api-key → `401 {"error":"API key inválida ou ausente"}`

Outros nomes NÃO servem:
- `document-converter-production.up.railway.app` → 502
- `converter-service.up.railway.app` → 404
- `document-converter.up.railway.app` → 404

O nome do serviço no Railway segue o nome do repo GitHub (`diploma-digital`), não o nome do subdiretório. Usar este host quando precisar testar via curl ou configurar `DOCUMENT_CONVERTER_URL` no Vercel.
