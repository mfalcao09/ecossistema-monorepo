# Pendências S10 — DS Agente (IA Autônoma)

> Gerado em 2026-04-21 ao final da sessão S10.
> Branch: `feature/atnd-s10-ds-agente`

## Abertas

| ID    | Tipo           | Descrição                                                                                                     | Responsável  | Bloqueio                        |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------- |
| P-130 | Config manual  | Cadastrar `OPENAI_API_KEY` no Supabase Vault (ECOSYSTEM) e expor como env na EF ou no Next.js em staging/prod | Marcelo      | Sem isso o agente não responde  |
| P-131 | Config manual  | Definir tags de ativação reais (UUIDs das labels "matricula", "duvida" etc.) no cadastro do agente FIC        | Marcelo      | Requer labels criadas no painel |
| P-132 | Ativação       | Ativar flag `ATENDIMENTO_DS_AGENTE_ENABLED=true` em staging → validar → ativar em prod                        | Marcelo      | Requer P-130 concluída          |
| P-133 | Seed / Upload  | Fazer upload do Regulamento Acadêmico real em PDF via `seed_fic_knowledge.py` (ou UI Knowledge Panel)         | Marcelo      | Documento físico necessário     |
| P-134 | Guardrails     | Definir e configurar guardrails: nomes de pessoas, dados financeiros específicos, respostas proibidas         | Marcelo + IA | Decisão de conteúdo             |
| P-135 | Monitoramento  | Configurar alerta quando `error IS NOT NULL` em `ds_agent_executions` (Sentry ou webhook Slack)               | Dev          | P-132 primeiro                  |
| P-136 | Rate-limit     | Implementar rate-limit por `conversation_id` no `runAgentForConversation` (evitar loop se bot responde bot)   | Dev          | Nice-to-have Fase 1             |
| P-137 | process_images | Implementar suporte a imagens (`process_images=true`): extrair texto via GPT-4o Vision antes do RAG           | Dev          | Fase 2                          |
| P-138 | Teste de carga | Simular 50 conversas simultâneas em staging para validar fire-and-forget e tempo de resposta                  | Dev/QA       | Pós P-132                       |
| P-139 | Dashboard      | Adicionar métricas DS Agente ao relatório S7 (handoffs/dia, tokens/dia, custo estimado OpenAI)                | Dev          | Fase 2                          |

## Resolvidas nesta sessão

| ID  | Descrição                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| —   | Migration `20260429_atendimento_s10_ds_agente.sql` criada (pgvector, ds_agents, ds_agent_knowledge, ds_agent_executions, match RPC) |
| —   | Libs `openai-client.ts`, `rag-client.ts`, `ds-agente-runner.ts` implementadas                                                       |
| —   | 7 rotas de API criadas (CRUD agentes, knowledge, execute/playground)                                                                |
| —   | UI completa: AgentCard, AgentWizard (4 steps), KnowledgePanel, PlaygroundPanel                                                      |
| —   | Webhook integrado (fire-and-forget após runAutomations)                                                                             |
| —   | Dashboard widget DS Agente adicionado ao DashboardHome                                                                              |
| —   | Menu lateral atualizado com item DS Agente (badge "IA")                                                                             |
| —   | Permissões seed atualizadas (Atendente: ds_ai view+create+edit)                                                                     |
| —   | 24/24 testes unitários + integração passando                                                                                        |
| —   | Script `seed_fic_knowledge.py` criado (FAQ + Grade + Calendário FIC 2026)                                                           |

## Próximos passos imediatos (pós-merge)

1. **Marcelo** → P-130: obter OPENAI_API_KEY e cadastrar no vault
2. **Marcelo** → executar `seed_fic_knowledge.py` em staging para popular base de conhecimento FIC
3. **Marcelo** → P-131: abrir painel DS Agente, editar agente FIC, configurar tags reais
4. **Dev** → P-132: ativar flag em staging, validar via Playground, ativar em prod
