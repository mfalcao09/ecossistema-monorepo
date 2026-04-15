---
name: Railway converter-service URL de produção
description: Railway converter-service URL de produção
type: reference
project: erp
tags: ["railway", "url", "converter", "extração", "endpoint"]
success_score: 0.9
supabase_id: ce9b478f-89f1-4d0e-9e0c-ddb27b4ec455
created_at: 2026-04-14 09:15:50.819402+00
updated_at: 2026-04-14 11:07:35.824465+00
---

URL de produção do microserviço `services/document-converter/` no Railway:

**`https://diploma-digital-production.up.railway.app`**

Verificado em 08/04/2026 (sessão 029):
- `GET /health` → `{"status":"ok","service":"document-converter","version":"1.0.0"}`
- `POST /extrair-documentos` sem x-api-key → `401 {"error":"API key inválida ou ausente"}`

Outros nomes NÃO servem:
- `document-converter-production.up.railway.app` → 502
- `converter-service.up.railway.app` → 404

O nome do serviço no Railway segue o nome do repo GitHub (`diploma-digital`), não o nome do subdiretório. Usar este host ao configurar `DOCUMENT_CONVERTER_URL` no Vercel.
