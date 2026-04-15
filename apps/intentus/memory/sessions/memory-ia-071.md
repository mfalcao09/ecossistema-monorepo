# Sessão 71 — Fix produção: predictive-default-ai CORS redeploy (15/03/2026)

- **Objetivo**: Fix do widget "Predição de Inadimplência (IA)" no Command Center que mostrava erro "Failed to send a request to the Edge Function"
- **Root cause**: Na sessão 65 (fix CORS massivo), o deploy de `predictive-default-ai` falhou silenciosamente — ficou na versão 1 (sem `app.intentusrealestate.com.br` na whitelist CORS). O arquivo local já tinha o fix (linha 23), mas o deploy não propagou
- **Evidência diagnóstica**: Supabase logs mostravam apenas OPTIONS requests (200, v1) sem POST requests — confirmando CORS preflight bloqueando
- **Fix**: Re-deploy via Supabase MCP com conteúdo do arquivo local (que já continha o CORS fix)
- **Deploy**: `predictive-default-ai` → version 2 (ID: 2c30f522-23fd-4dbc-86f4-d8950f1c3c03, ACTIVE, verify_jwt: false)
- **Nenhum arquivo modificado** — código local já estava correto, apenas deploy estava desatualizado
- **Edge Functions — Versões atualizadas**:
  - `predictive-default-ai` → version 2 (CORS fix confirmado)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
