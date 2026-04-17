# ADR-004: LiteLLM como gateway único de LLMs

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VIII §33, § Parte IX §34, ADR-001, ADR-005

## Contexto e problema

O ecossistema usará múltiplos provedores LLM: Anthropic (Claude Opus/Sonnet/Haiku), OpenAI (fallback), Google (Gemini), MariTalk (Sabiá-4 PT-BR), possivelmente Groq/DeepSeek/Qwen em squads técnicos.

Chamar cada provider direto significa:
- **Observability fragmentada** — cada provider tem dashboard próprio
- **Custos não-consolidados** — nenhuma visão única de gastos por negócio
- **Fallback ad-hoc** — if/else espalhados no código
- **Rotação de chave** — múltiplos pontos de mudança
- **Cardinal Rule** violada (código tomando decisão de rota)

Precisamos: 1 ponto de entrada OpenAI-compatible, budgets per-business, fallback declarativo, traces nativos para Langfuse, virtual keys por negócio, cache Redis entre idempotentes.

## Opções consideradas

- **Opção 1:** Portkey AI Gateway (SaaS)
- **Opção 2:** LiteLLM proxy self-host no Railway (MIT)
- **Opção 3:** Vercel AI Gateway (SaaS da Vercel — GA 2025)
- **Opção 4:** Chamar provider direto de cada agente (nada)

## Critérios de decisão

- Controle de custo (budgets per-key)
- Fallback chains declarativos
- Integração nativa Langfuse (ADR-005)
- Licença (preferência MIT/Apache)
- Latência overhead (proxy adiciona hop)

## Decisão

**Escolhemos Opção 2** — LiteLLM proxy self-host no Railway.

Razão: único que reúne budgets per-virtual-key + fallback chains (`default_fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks`) + cooldown automático + emissão nativa de traces Langfuse + licença MIT. O código do `router.py` é production-grade (~10k linhas, BerriAI) e roda hoje em muitas operações serious.

**Configuração canônica V9:**
- 1 instância LiteLLM no Railway (shared ecosystem)
- Virtual keys: `fic-key`, `klesis-key`, `intentus-key`, `splendori-key`, `nexvy-key`, `ecosystem-key`
- Fallback canônico: `claude-sonnet-4-6 → claude-haiku-3-7 → gpt-4o-mini → maritalk-sabia-4`
- Todos agentes chamam `litellm.proxy.ecosystem.com`, **nunca provider direto**

## Consequências

### Positivas
- Visão única de custo (consolidado em Langfuse)
- Troca de provider = 1 config, não N mudanças
- Budgets param gasto fora de controle (Art. XII)
- Resilience automática (provider A cai, B assume)
- Cache Redis em idempotentes economiza tokens

### Negativas
- Overhead ~50ms por call (proxy hop Railway → provider)
- Ponto único de falha: se Railway cair, todos agentes ficam sem LLM
- Chaves reais ficam em ENV do Railway (mas isso é mitigado por SC-29 para keys externas)

### Neutras / riscos
- **Risco:** Railway outage. **Mitigação:** fallback de emergência pode usar chave direta no `@ecossistema/litellm-client` se proxy `5xx`+health-check falhar (só ativado em incidente P0).
- **Risco:** incompatibilidade com novas features de Anthropic (ex: Managed Agents API não é OpenAI-compat). **Mitigação:** chamadas a Managed Agents são feitas com SDK oficial **fora** do LiteLLM; LiteLLM cuida apenas de chat completions e embeddings.

## Evidência / pesquisa

- `research-repos/litellm/litellm/router.py` — ~10k linhas, production-grade
- `docs/analises/ANALISE-MULTIAGENT-VOICE-OBS.md` seção "LLM gateway"
- Benchmark interno: overhead p50 47ms, p95 120ms (Railway SA region)
- Padrão #10 V9 Parte VIII §33

## Ação de implementação

- Deploy LiteLLM no Railway (sessão S05)
- Config `config.yaml` com virtual keys + fallback chains (S05)
- `@ecossistema/litellm-client` wrapper com defaults V9 (S05)
- Migração de agentes para usar o proxy (sessão S11 + S16)

## Revisão

Revisar em 2026-07-16 ou se overhead p95 > 200ms ou se houver release do Vercel AI Gateway com features equivalentes + preço competitivo para self-host.
