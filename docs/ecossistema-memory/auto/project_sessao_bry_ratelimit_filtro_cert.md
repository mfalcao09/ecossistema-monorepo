---
name: sessao_bry_ratelimit_filtro_certificado
description: Sessão BRy — rate limit export→assinatura 30/min + filtro passos por certificado selecionado (CPF/CNPJ)
type: project
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
- Aviso amarelo quando cert não tem passos pendentes

## Deploy
- `dpl_7mmLSpgP` (41563da) READY — rate limit
- `dpl_AvbU` (ca0eabc) READY — filtro certificado
