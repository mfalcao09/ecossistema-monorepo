# Ecossistema Orchestrator

FastAPI que expõe Anthropic Managed Agents via HTTP/SSE — coração runtime do ecossistema V9.

## O que é

Ponto de entrada HTTP único para todos os agentes (Claudinho, C-Suite, Diretores). Recebe queries, faz streaming SSE, gerencia HITL (Art. II) e integra hooks constitucionais.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check |
| `GET` | `/agents` | Lista agentes registrados |
| `POST` | `/agents/{id}/run` | Executa agente (SSE) |
| `POST` | `/agents/{id}/resume` | Retoma sessão (SSE) |
| `POST` | `/webhooks/status-idled` | HITL — sessão aguardando aprovação |
| `POST` | `/webhooks/approval/{id}` | Resolve aprovação |
| `GET` | `/webhooks/approvals/pending` | Lista aprovações pendentes |
| `GET` | `/sessions/{id}` | Inspeciona sessão |

## Uso rápido

```bash
# 1. Criar agentes (uma vez)
python claudinho_orchestrator.py --setup

# 2. Subir o servidor
uvicorn orchestrator.main:app --host 0.0.0.0 --port 8000

# 3. Health check
curl http://localhost:8000/health

# 4. Listar agentes
curl http://localhost:8000/agents \
  -H "Authorization: Bearer owner_<seu_token>"

# 5. Run com stream SSE
curl -N http://localhost:8000/agents/claudinho/run \
  -H "Authorization: Bearer owner_<seu_token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"Olá Claudinho, teste.","user_id":"marcelo"}'
```

## Adicionar agente novo

1. Adicionar entrada em `config/agents.yaml`
2. Criar system prompt em `claudinho_orchestrator.py` (`build_xxx_system_prompt()`)
3. Executar `python claudinho_orchestrator.py --setup` → agent criado na API
4. O registry carrega automaticamente no próximo restart

## Variáveis de ambiente

```env
ANTHROPIC_API_KEY=sk-ant-...
OWNER_TOKEN_HASH=<sha256 de "owner_<token>">
JWT_SECRET=...
SUPABASE_URL=https://gqckbunsfjgerbuiyzvn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
# Pendentes de sessões futuras:
LITELLM_URL=...          # TODO(S5)
LANGFUSE_HOST=...        # TODO(S9)
CREDENTIAL_GATEWAY_URL=... # TODO(S8)
```

## Dependências por sessão

- **S1** ✅ `@ecossistema/constitutional-hooks` — hooks bridge
- **S2** ⏳ `@ecossistema/prompt-assembler` — 9-layer system prompt
- **S4** ⏳ Migrations Supabase — `ecosystem_sessions`, `approval_requests`
- **S5** ⏳ LiteLLM — gateway de modelos
- **S7** ⏳ `@ecossistema/memory` — recall/add
- **S8** ⏳ SC-29 Edge Function — credential gateway
- **S9** ⏳ Langfuse — observabilidade de traces
