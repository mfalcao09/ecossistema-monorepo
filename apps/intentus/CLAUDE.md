# Intentus Real Estate Platform — Notas do Projeto

## Regras de Sessão (OBRIGATÓRIO)

1. **Auto-save absoluto**: TODA interação, decisão, código, discussão e resultado deve ser salvo automaticamente nas memórias e/ou nos arquivos da pasta `memory/`. Marcelo NUNCA deve precisar pedir para salvar. Isso inclui: atualizações de status, novos achados, decisões técnicas, bugs encontrados, deploys, e qualquer evolução do projeto.
2. Todo o desenvolvimento deve ser feito utilizando o Plugin Minimax M2.7.
3. **Commit a cada modificação**: Após CADA feature ou fix implementado, a IA DEVE enviar o summary e description do commit para Marcelo fazer via GitHub Desktop. NUNCA acumular múltiplas sessões sem commit. Formato: conventional commits (`feat:`, `fix:`, `docs:`, etc.) + Co-Authored-By.

## Memory — Quick Reference

| Quem | Info |
|------|------|
| **Marcelo** | Fundador/CEO — Intentus, Nexvy, Klésis, FIC, Splendori. Email: mrcelooo@gmail.com |
| **Claudinho** | Apelido carinhoso que Marcelo dá ao Claude (assistente IA) |
| **Buchecha** | Apelido carinhoso que Marcelo dá a Minimax M2.7 |

| Projeto | Status |
|---------|--------|
| **pricing-ai v24r8** | ⏸️ Standby — v42 com erros, aguardando alternativa Urbit |
| **Integração Urbit** | 🔄 Negociação comercial — Marcelo em contato com Urbit para credenciais/pricing |
| **Onboarding** | ✅ Completo — checkAutoComplete wired, tour ativo, demo mode, empty states |
| **Notificações** | ✅ Completo v2 — Smart Notifications: priority scoring, snooze, email digest |
| **Assinatura digital** | P2 — 0/5 provedores funcionais, workaround manual OK |
| **Plugin MiniMax M2.7** | ✅ Funcional — v0.4.0 (6 tools operacionais) |
| **Cronograma IA-Native** | ✅ COMPLETO — CLM (2/2 fases), CRM (4/4 fases), Relationship (4/4 fases, 12 features) |
| **Parcelamento Fase 5** | ✅ COMPLETO — Blocos A+B+C+D (sessões 133-136) |
| **Parcelamento Roadmap** | 🔄 8 blocos restantes: F→G→H→K→L→E→J→I (~128 US, 33-51 sessões). Próximo: Bloco F |

→ Glossário completo: `memory/glossary.md`
→ Perfis: `memory/people/`
→ Projetos: `memory/projects/`
→ Histórico das Sessões (1-139): `memory/sessions/`

## Deploy e Infraestrutura
- **Deploy**: Via **Vercel**
- **Backend**: Supabase (project ID: `bvryaopfjiyxjgsuhjsb`)
- **Repo**: github.com/mfalcao09/intentus-plataform
- **Stack**: React + Vite + TypeScript + shadcn-ui + Tailwind CSS + Supabase

## Edge Functions — Principais

| Function | Status | Descrição |
|----------|--------|-----------|
| `pricing-ai` | ⏸️ Standby | IA de precificação — Dual actor. Aguardando alternativa Urbit API |
| `parse-contract-ai` | ✅ Ativo | Extração de dados de contratos PDF via Gemini 2.0 Flash |
| `copilot` | ⚠️ Pendente | Assistente IA Agentic Mode com 12 tools. Pendente CORS na v11 |
| `clm-ai-insights` | ✅ Ativo | Contract Analytics Avançado. Compliance BR 10 regras |
| `commercial-automation-engine`| ✅ Ativo | Engine de automações comerciais v2. JSONB conditions, multi-step |
| `commercial-pulse-feed` | ✅ Ativo | Pulse/Feed Central v1. 17 event types, priority scoring |
| `commercial-lead-scoring`| ✅ Ativo | Lead Scoring IA v1. 8 fatores + AI boost Gemini 2.0 Flash |

*(Para demais Edge Functions e notas técnicas profundas, consultar as memórias modulares na pasta `memory/`)*

## Segurança e Padrões
- **DOMPurify** (`src/lib/sanitizeHtml.ts`): SEMPRE sanitizar HTML gerado por IA antes de `dangerouslySetInnerHTML`
- **`profiles.id` ≠ `auth.users.id`**: CRÍTICO — `session.user.id` retorna UUID de auth.users. Sempre usar `.eq("user_id", userId)`.
- **`.maybeSingle()`**: SEMPRE usar em vez de `.single()` para evitar crash PGRST116.
- **NUNCA misturar dynamic/static imports**: Causa TDZ error no bundle Vite/Rollup.