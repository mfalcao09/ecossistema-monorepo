---
name: sessao_bry_ratelimit_filtro_certificado
description: sessao_bry_ratelimit_filtro_certificado
type: project
project: erp
tags: ["bry", "rate-limit", "filtro", "certificado", "assinatura"]
success_score: 0.85
supabase_id: 45a2c71e-74c8-493a-805b-0082f9215a37
created_at: 2026-04-14 09:14:35.295761+00
updated_at: 2026-04-14 10:07:28.820271+00
---

## Rate Limit Assinatura (commit 41563da)
- Nova categoria `assinatura` no rate-limit.ts: 30 req/min (antes `export` 5/min)
- Aplicada em Initialize, Finalize e POST /assinar
- Causa raiz do 429: 2 eCPF + 1 eCNPJ = 8 chamadas Init+Fin, estourava 5/min

## Filtro de Passos por Certificado (commit ca0eabc)
- `PassoAssinatura` agora tem `cpfAssinante` + `tipoCertificado`
- API GET /assinar retorna `assinantes[]` na resposta
- Frontend cruza `cert.name` (normalizado) com `assinante.nome` para identificar
- Passos filtrados: só mostra "Assinar" nos passos do certificado selecionado
- Passos de outros: opacity-40 + label "Outro certificado"
- Botão batch: "Assinar N passos deste certificado" (não todos)
