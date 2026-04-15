---
name: Etapa 1.1 Sprint 2 — rota /extrair-documentos no Railway
description: Commit 5c6bf66 (08/04/2026) adiciona POST /extrair-documentos no converter-service com Gemini 2.5 Flash fire-and-forget + SSRF guards, deploy Railway confirmado live
type: project
---

**Status:** ✅ Entregue e em produção no Railway (08/04/2026, sessão 029).

**Commit:** `5c6bf66` — `feat(converter): add POST /extrair-documentos with Gemini 2.5 Flash + SSRF guards`

**Arquivos:**
- `services/document-converter/src/extractor.js` (novo, 195 linhas) — wrapper REST direto pra Gemini 2.5 Flash (sem SDK por bug `@ai-sdk/google@3.x`) + `downloadFile()` com AbortController.
- `services/document-converter/src/server.js` — rota `POST /extrair-documentos` (202 Accepted fire-and-forget), `processarExtracao()` background, `agregarDados()` first-non-empty-wins, `enviarCallback()` com retry 3x + backoff exponencial (2s→4s→8s).
- `services/document-converter/README.md` — documentação do contrato + `EXTRACAO_CALLBACK_SECRET` na tabela.

**Hardening pós-code-review (Buchecha/MiniMax M2.7):**
- SSRF allowlist HTTPS: `isSignedUrlAllowed()` (*.supabase.co/storage/v1/object/) e `isCallbackUrlAllowed()` (gestao.ficcassilandia.com.br, diploma.ficcassilandia.com.br, *.vercel.app — configurável via `CALLBACK_ALLOWED_HOSTS`).
- Timeouts AbortController: download 30s, Gemini 60s, callback 15s.
- `erro_parcial` para falhas parciais (campo `erro` reservado pra 100% de falha).

**Verificação live (Railway):**
- URL: `https://diploma-digital-production.up.railway.app` (ver `reference_railway_converter_url.md`)
- `/health` → 200 OK
- `/extrair-documentos` sem key → 401 "API key inválida ou ausente"
- `/rota-inexistente` → 404 (prova que 401 acima é da rota nova e não catch-all)

**Why:** Primeira peça da Sprint 2 do plano `plano-tecnico-fluxo-novo-processo-sessao-028-v2.md`. Bypass do timeout 60s Vercel Pro via fire-and-forget + callback HMAC.

**How to apply:** Próximas etapas da Sprint 2 (Next.js: rota POST /api/extracao/sessoes/iniciar + callback PUT /api/extracao/sessoes/[id]/callback) já podem consumir este endpoint. Shared secret `EXTRACAO_CALLBACK_SECRET` já provisionado em Vercel + Railway (mesmo valor do `.env.local`).
