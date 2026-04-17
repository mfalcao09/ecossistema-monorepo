# ADR-006: FastMCP v3 como framework canônico para MCP servers

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VIII §30, `packages/mcp-servers/template/`

## Contexto e problema

O ecossistema expõe múltiplos MCP servers (Supabase CRUD, Credentials via SC-29, Memory via Mem0, Audit, WhatsApp via Evolution, e um per-business: fic-mcp, klesis-mcp, intentus-mcp, etc). Cada server precisa de:

- Auth provider (Supabase JWT, owner token, scope-based RBAC)
- Middleware stack (logging, rate-limit, tracing, errors)
- Tool/Resource/Prompt declarativos com schema auto-gerado de type hints
- Proxy de MCP servers de terceiros (wrap com auth + logging)
- OpenAPI provider — auto-gerar tools de qualquer spec OpenAPI existente
- Session transforms para RBAC per-session

Implementar tudo em cima do MCP Python SDK oficial "puro" é ~1.500 linhas de boilerplate **por server**, multiplicado por ~10 servers.

## Opções consideradas

- **Opção 1:** MCP Python SDK oficial puro (Anthropic)
- **Opção 2:** FastMCP v3 (PrefectHQ, Apache-2.0)
- **Opção 3:** Build custom framework interno

## Critérios de decisão

- Tempo de implementação per server
- Maturidade e manutenção (commits recentes, CI green, releases frequentes)
- Cobertura das capacidades acima (auth + middleware + OpenAPI + proxy)
- Licença (Apache-2.0 ou MIT)

## Decisão

**Escolhemos Opção 2** — FastMCP v3.

Motivo: é o framework mais usado no ecossistema MCP (referências indicam ~70% dos MCP servers cross-language rodam em FastMCP), tem auth pluggable, middleware stack, OpenAPI provider, FastMCPProxy, tool transforms — tudo out-of-the-box. Licença Apache-2.0.

## Consequências

### Positivas
- **Template reutilizável** — `packages/mcp-servers/template/` (criado em S03) é FastMCP v3
- Auth + middleware + tracing em minutos, não dias
- OpenAPI provider permite wrappear APIs internas sem reescrever tools
- FastMCPProxy simplifica wrappear servers de terceiros com auth + log
- Deploy Railway com `uv` + Dockerfile padronizado

### Negativas
- Dependência adicional (update do FastMCP requer teste dos 10 servers)
- Abstração esconde parte do MCP SDK cru (pode complicar debugging raro)

### Neutras / riscos
- **Risco:** breaking change em major version. **Mitigação:** versão fixa em `pyproject.toml`; upgrade controlado por sprint.
- **Risco:** bug em middleware custom. **Mitigação:** testes em `packages/mcp-servers/template/tests/test_middleware.py` cobrem happy + error paths (S03 validou).

## Evidência / pesquisa

- `research-repos/fastmcp/` — código-fonte completo analisado
- `packages/mcp-servers/template/` — template canônico entregue em S03 com 151 linhas de testes de auth + 103 de middleware + FastMCP v3 rodando
- `packages/mcp-servers/README.md` + `packages/mcp-servers/generator/` — gerador CLI validado em S03
- MASTERPLAN-V9 § Parte VIII §30

## Ação de implementação

- Template canônico em `packages/mcp-servers/template/` (✅ entregue S03)
- Generator CLI `create-mcp-server` (✅ entregue S03)
- Instanciar MCPs: supabase-mcp, credential-mcp, memory-mcp, audit-mcp, whatsapp-mcp, {fic,klesis,intentus,splendori,nexvy}-mcp (sessões futuras)
- Registrar no `packages/mcp-servers/registry.yaml`

## Revisão

Revisar em 2026-10-16 ou quando Anthropic publicar SDK MCP oficial com features equivalentes estáveis.
