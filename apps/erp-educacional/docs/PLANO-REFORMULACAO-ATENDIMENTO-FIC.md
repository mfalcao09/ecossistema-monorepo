# Plano de Reformulação Total — Módulo de Atendimento FIC

> **Criado:** 2026-04-20 · Sessão S089
> **Substitui:** `ATENDIMENTO-PLANO-v2-SESSAO088.md` (mantido como histórico)
> **Base:** Estado atual S1-S3 em produção + benchmark de 58 vídeos DKW/Nexvy/helenaCRM + 225 screenshots + plano v2 de 13/04
> **Objetivo:** Transformar o módulo Atendimento do ERP-FIC no **melhor módulo de atendimento educacional do Brasil**, integrando WhatsApp/Instagram/CRM/IA/agenda em um único fluxo conectado ao ensino (matrículas, secretaria, financeiro, diploma).

---

## Sumário executivo

### O que temos hoje
**Sprint 1-3 em produção** na FIC (`gestao.ficcassilandia.com.br/atendimento`):
- 9 tabelas base + 3 de filas no Supabase (schema rico, pronto para escalar)
- Webhook WhatsApp **Meta Cloud API v19.0** funcionando (HMAC-SHA256, phone_number_id `938274582707248`)
- Inbox 3 painéis (lista + chat + info) com Realtime Supabase, envio otimístico
- Filas seed: Secretaria (azul) / Financeiro (laranja) / Matrículas (verde)
- TopBar com 6 abas (Conversas / Contatos / Canais / Automações / Relatórios)
- 4 agentes cadastrados (Fabiano, Jhiully, Cristina, Marcelo), n8n ID 2967 ativo

### O que estamos construindo
**Um concorrente direto da Nexvy/helenaCRM**, mas com **vantagem assimétrica**: integração nativa com o ERP educacional (alunos, matrículas, financeiro, diploma). Nenhum concorrente tem isso.

### O que diferencia este plano
1. **Vantagem de contexto**: 58 vídeos DKW processados (1726 frames + transcrições integrais + timestamps exaustivos) = nenhuma feature do concorrente escapa
2. **Design tokens prontos** do Nexvy (Primary `#345EF3`, Roboto 14px, MUI v4, radius 10px/8px) como baseline — **pulamos toda a fase de descoberta de UX**
3. **Alinhamento de linguagem**: todas as features mapeadas 1:1 com os nomes que a Nexvy usa (o Marcelo já conhece a interface — migração cognitiva zero)
4. **Inteligência bidirecional**: o módulo Atendimento conversa com Diploma, Financeiro, Secretaria, Alunos — não é uma ilha
5. **Roadmap de multi-tenant**: desde S1 as tabelas têm `account_id` nullable — ao virar SaaS (Nexvy-like whitelabel próprio), basta preencher

### Horizonte
- **Fase 1 (8 semanas — até meados de junho):** S4 Kanban CRM + S5 Templates/Agendamentos + S6 Contatos/Cargos — **paridade funcional com helenaCRM**
- **Fase 2 (6 semanas — até final de julho):** S7 Dashboards + S8 Automações/Webhooks/n8n + S9 DS Voice (biblioteca) — **recursos diferenciadores**
- **Fase 3 (8 semanas — até final de setembro):** S10 DS Agente OpenAI + DS Bot visual + integração RAG FIC + Jarvis voice
- **Fase 4 (paralela, trigger quando Nexvy saturar):** Multi-tenant + Painel Parceiro + SaaS público (Klésis como 1º tenant de teste)

---

# Parte 1 — Estado atual da FIC (inventário)

## 1.1 Frontend (`/src/app/(erp)/atendimento/`)

| Rota | Arquivo | Status | Sprint |
|---|---|---|---|
| `/atendimento` | `layout.tsx` | ✅ TopBar 6 abas | S1 |
| `/atendimento` | `page.tsx` | 🔄 Skeleton dashboard | S7 |
| `/atendimento/conversas` | `conversas/page.tsx` | ✅ Inbox 3 painéis funcionando | S3 |
| `/atendimento/contatos` | `contatos/page.tsx` | 🔄 Tabela básica, busca, tags | S1 |
| `/atendimento/canais` | `canais/page.tsx` | 🔄 Cards de inbox (WABA+IG+Email+SMS+API) | S1 |
| `/atendimento/automacoes` | `automacoes/page.tsx` | ❌ Vazio | S8 |
| `/atendimento/relatorios` | `relatorios/page.tsx` | ❌ Vazio | S7 |

**Componentes-chave existentes:**
- `ConversasList.tsx` (sidebar 320px) — 5 abas (Todas/Em atendimento/Aguardando/Minhas/Não atribuídas), badges unread, filtros canal/status
- `ChatPanel.tsx` — bubbles in/out, status icons (sent/delivered/read/failed/pending), Realtime Supabase, envio otimístico
- `ContactInfoPanel.tsx` — info contato, fila com cor, atendente, datas

**Ausentes (a construir):**
- `KanbanBoard.tsx`, `DealCard.tsx`, `LeadDetailModal.tsx` (S4)
- `TemplateGrid.tsx`, `TemplateEditor.tsx`, `WABAPreview.tsx` (S5)
- `ScheduleCalendar.tsx`, `ScheduleModal.tsx` (S5)
- `ContactTable.tsx` (versão completa com bulk actions), `ImportCSVModal.tsx`, `CustomFieldsEditor.tsx` (S6)
- `PermissionMatrix.tsx`, `RoleEditor.tsx` (S6)
- `AutomationRuleBuilder.tsx`, `ConditionChain.tsx`, `ActionChain.tsx` (S8)
- `FlowBuilder.tsx` (canvas para DS Bot — S10)
- `AgentConfigPanel.tsx` (DS Agente — S10)

## 1.2 Backend (`/src/app/api/atendimento/`)

| Rota | Método | Status |
|---|---|---|
| `/conversas` | GET | ✅ Lista com 5 abas + busca + paginação |
| `/conversas/[id]` | GET · PATCH | ✅ Detalhe + atualiza status/assignee/queue/priority |
| `/conversas/[id]/messages` | POST | ✅ Envio outbound via Meta API |
| `/webhook` | GET · POST | ✅ Verify Token + HMAC-SHA256 + fallback inbox |
| `/debug-write` | POST | ✅ Debug only |

**A construir em cada sprint:**
- S4: `/pipelines`, `/pipelines/[id]/deals`, `/deals/[id]`, `/deals/[id]/activities`, `/deals/[id]/notes`, `/protocols`
- S5: `/templates`, `/templates/sync-meta`, `/scheduled-messages`, `/scheduled-messages/worker` (cron)
- S6: `/contacts/import`, `/contacts/export`, `/contacts/merge`, `/roles`, `/role-permissions`, `/saved-views`
- S7: `/metrics/daily`, `/reports/[type]` (vendas/atividades/conversas/sdr/closer), `/widgets`
- S8: `/webhooks/inbound/[slug]`, `/webhooks/outbound`, `/api-keys`, `/api/public/v1/*` (API REST pública), `/link-redirects/[slug]`
- S9: `/ds-voice/messages`, `/ds-voice/audios`, `/ds-voice/media`, `/ds-voice/funnels`, `/ds-voice/triggers`
- S10: `/ds-agente/[id]`, `/ds-bot/flows/[id]`, `/ds-bot/execute`

## 1.3 Database (Supabase `ecosystem` project)

### Tabelas existentes (S1-S3)

| Tabela | Linhas produção | Observação |
|---|---|---|
| `atendimento_inboxes` | ~3 | WABA FIC ativo, IG ativo, WhatsApp Antigo desconectado |
| `atendimento_contacts` | ~245 | Base real importada |
| `atendimento_conversations` | ~50+ | Fluxo real rodando |
| `atendimento_messages` | ~1k+ | Histórico WABA 24h+ |
| `atendimento_labels` | 6 | Seed Alunos/1700/Matrícula/Financeiro/Secretaria/Reprovada |
| `atendimento_conversation_labels` | M2M | |
| `atendimento_agents` | 4 | Fabiano / Jhiully / Cristina / Marcelo |
| `atendimento_automation_rules` | 2 | Seed Financeiro + Matrícula keywords |
| `atendimento_whatsapp_templates` | 0 | Schema pronto, vazio |
| `atendimento_queues` | 3 | Secretaria (azul) / Financeiro (laranja) / Matrículas (verde) |
| `atendimento_queue_members` | 0 | A popular |
| `atendimento_agent_statuses` | 0 | A popular |

### Tabelas a criar (roadmap)

| Sprint | Tabelas novas |
|---|---|
| **S4** | `pipelines`, `pipeline_stages`, `deals`, `deal_activities`, `deal_history_events`, `deal_notes`, `protocols`, `campaigns`, `contact_custom_fields`, `stage_task_cadences`, `products` |
| **S5** | `whatsapp_templates` (expansão), `scheduled_messages`, `calendar_events` |
| **S6** | `contact_company_custom_fields`, `saved_views`, `agent_roles`, `role_permissions`, `account_settings` |
| **S7** | `metrics_snapshots`, `widgets`, `report_definitions` |
| **S8** | `webhook_inbound_endpoints`, `webhook_outbound_urls`, `automation_executions`, `link_redirects`, `api_keys`, `team_chats`, `team_messages` |
| **S9** | `ds_voice_folders`, `ds_voice_messages`, `ds_voice_audios`, `ds_voice_media`, `ds_voice_documents`, `ds_voice_funnels`, `ds_voice_funnel_steps`, `ds_voice_triggers` |
| **S10** | `ds_agents`, `ds_agent_knowledge`, `ds_bots`, `ds_bot_flows`, `ds_bot_nodes`, `ds_bot_executions` |

### Campos a adicionar a tabelas existentes

| Tabela | Campos |
|---|---|
| `conversations` | `deal_id FK`, `protocol_count`, já tem `queue_id/ticket_number/window_expires_at/last_read_at/waiting_since` |
| `messages` | `media_type`, `media_url`, `waba_template_id`, `connection_token` |
| `agents` | `role_id FK`, `voip_number` (futuro), `pause_reason` já existe |
| `contacts` | `color_hex`, `has_duplicates BOOL`, `source VARCHAR`, `aluno_id FK → alunos` |
| `inboxes` | `connection_token`, `waba_account_id` (já tem `provider_config` JSONB) |

## 1.4 Integrações externas

| Integração | Status | Credenciais |
|---|---|---|
| Meta Cloud API (WhatsApp) | ✅ S2 | `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID=938274582707248` + `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_TOKEN=fic_waba_verify_2026_xK9mPqR3tL7vW` · WABA ID: `1833772130511929` |
| Meta Business Partner (Nexvy) | 🔄 ADR-017 aceito 19/04 | Business Verification aprovada, aplicação MBP em andamento |
| n8n | ✅ ID 2967 "N8N – AF EDUCACIONAL" | Integração pronta pra ser plugada em S8 |
| Instagram Business | 🔄 Conectado no Nexvy, precisa conectar no ERP | Via Meta Graph API |
| Google Calendar | ❌ | OAuth2 Google em S5+ |
| Typebot / Flow Builder | ❌ | Custom visual builder em S10 |
| OpenAI (DS Agente) | ❌ | `OPENAI_API_KEY` via credential-gateway em S10 |
| Deepgram (STT) | ❌ | Fase 3 Jarvis E3 |
| ElevenLabs (TTS) | ❌ | Fase 3 Jarvis E3 |

## 1.5 Packages reutilizáveis do ecossistema

| Package | Uso no atendimento |
|---|---|
| `@ecossistema/credentials` | Guarda tokens Meta, n8n, OpenAI (SC-29 Vault) |
| `@ecossistema/agentes` | Prompts DS Agente (S10) |
| `@ecossistema/memory` | Contexto do aluno no DS Agente |
| `@ecossistema/rag` | Base de conhecimento FIC (regulamento, FAQ, processos) |
| `@ecossistema/tools` | Wrappers Supabase/n8n/Meta |
| `@ecossistema/billing` | Ponte "Solicitar pagamento" no chat (Inter boletos) |
| `@ecossistema/task-registry` | Registrar tarefas automáticas |

**Nota crítica:** `apps/intentus/src/components/chat/*` tem 2.7k linhas de UI chat mas é **isolado, imobiliária-first**. Serve como **referência de padrão**, não template reutilizável.

## 1.6 Documentação viva

| Documento | Status |
|---|---|
| `ADR-017-nexvy-meta-business-partner.md` | ✅ aceito 19/04 |
| `NEXVY-REFERENCIA-ATENDIMENTO.md` (memory) | ✅ 20+ prints primeiro batch |
| `ATENDIMENTO-PLANO-v2-SESSAO088.md` (memory) | ✅ 10 sprints detalhados |
| **Este documento (S089)** | ✅ sucede o v2 — fonte única de verdade |

---

# Parte 2 — Benchmark consolidado (Nexvy/DKW + helenaCRM)

## 2.1 Fonte primária do benchmark

| Ativo | Localização | Conteúdo |
|---|---|---|
| **58 vídeos processados** | `docs/research/nexvy-whitelabel/` | 1.726 frames + 58 transcrições + 58 timestamps exaustivos |
| **225 screenshots manuais** | `docs/research/nexvy-whitelabel/screenshots/` | Navegação guiada console.nexvy.tech |
| **Plano UI 24 seções** | `PLANO-LEVANTAMENTO-NEXVY.md` (branch `claude/competent-saha-13df32`, commit `7ec1c94`) | Design tokens + componentes identificados |
| **INDEX.md** | `docs/research/nexvy-whitelabel/INDEX.md` | Mapa navegável |

## 2.2 Design tokens canônicos (extraídos)

```css
/* Cores primárias */
--primary:      #345EF3;  /* Azul royal — CTA, links, ativo */
--primary-hover:#2B4ECF;
--primary-bg:   #EEF1FE;  /* Fundo claro de badges/highlights primários */

/* Cinzas / neutros */
--bg:           #FFFFFF;
--bg-subtle:    #F5F7FA;  /* Fundo de painéis secundários */
--bg-muted:     #F0F2F5;  /* Chat list background */
--border:       #E4E7EC;
--text:         #1D2939;  /* Texto primário */
--text-muted:   #667085;
--text-subtle:  #98A2B3;

/* Semânticos */
--success:      #12B76A;  /* Online, enviada */
--warning:      #F79009;  /* Pausado, aguardando */
--danger:       #F04438;  /* Offline, falha */
--info:         #0BA5EC;

/* Tipografia */
--font-body:    'Roboto', 'Inter', -apple-system, sans-serif;
--font-size-xs: 12px;
--font-size-sm: 13px;
--font-size:    14px;     /* Base Nexvy */
--font-size-md: 15px;
--font-size-lg: 16px;

/* Raios e espaçamento */
--radius-sm:    6px;
--radius-md:    8px;     /* Cards, inputs */
--radius-lg:    10px;    /* Modais, painéis */
--radius-full:  999px;

/* Sombras */
--shadow-sm:    0 1px 2px rgba(16,24,40,0.06);
--shadow-md:    0 4px 8px -2px rgba(16,24,40,0.1);
--shadow-lg:    0 12px 16px -4px rgba(16,24,40,0.08);

/* Medidas de layout */
--sidebar-w:    245px;   /* Menu lateral principal Nexvy */
--list-w:       320px;   /* Lista de conversas */
--info-w:       360px;   /* Painel direito de contato */
--kanban-col-w: 300px;   /* Coluna Kanban */
--topbar-h:     56px;
```

**Tailwind config sugerido:** criar `apps/erp-educacional/tailwind.config.ts` com estas tokens em `theme.extend.colors/fontSize/borderRadius`.

## 2.3 Inventário COMPLETO de features do benchmark

Organizado por área funcional, cruzando os 58 vídeos. Status: ✅ já temos · 🔄 parcial · ❌ construir.

### A. Dashboard / Home (vídeo `Lus6OhCWhrg`, screenshots `painel-principal-*`)

| Feature | Status FIC | Detalhe visto no benchmark |
|---|---|---|
| Widget Canais (conectado/desconectado) | ❌ S7 | Cards coloridos por canal + contador conversas |
| Widget CRM (total negócios por pipeline) | ❌ S7 | Barra percentual por etapa + valor financeiro total |
| Widget Conversas (abertas/aguardando/resolvidas) | ❌ S7 | 3 números grandes + mini-gráfico últimos 7 dias |
| Widget Atividades (próximas/hoje/atrasadas) | ❌ S7 | Contadores + botão "Criar atividade" |
| Widget Agentes IA (ativos/erros) | ❌ S10 | Badge "N agentes em atividade · M erros recentes" |
| Widget de boas-vindas personalizável | ❌ S7 | Card com nome do usuário + saudação |

### B. Conversas / Inbox (vídeos `Lus6OhCWhrg`, `_L92FINjcUI`, `GTX_QLA1zeg`, `XeemWygayPo`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **3 painéis (lista 320px + chat + info 360px)** | ✅ S3 | Divisão clássica replicada |
| 5 abas padrão (Todas/Em atendimento/Aguardando/Minhas/Não atribuídas) | ✅ S3 | Com badge unread por aba |
| **Fila "Novos" / "Meus" / "Outros"** (helenaCRM) | 🔄 | Equivalente às 5 abas, renomear opcional |
| Abas customizadas (saved views) | ❌ S6 | Modal "Nova Aba" com filtros (pipeline + coluna + tags + responsáveis) |
| Busca global (nome/número/ID ticket) | 🔄 | Já tem busca, falta filtro por ticket# |
| Filtros avançados (canal/status/tags/período) | 🔄 S3 | Canal e status ok; tags e período a adicionar |
| Filtro tempo sem resposta (urgência) | ❌ | Badge vermelho se `now - last_agent_message > 30min` |
| **Chat com bubbles in/out** | ✅ S3 | |
| Status icon (sent/delivered/read/failed/pending) | ✅ S3 | Ícones cinza→azul→duplo azul |
| **Toolbar 5 tipos** (Texto/Emoji/Áudio/Anexo/Template/DS Voice) | 🔄 S3 | Apenas texto hoje |
| Gravação de áudio direto no chat | ❌ S5 | Botão microfone → modal gravação + preview |
| Upload de anexo (imagem/vídeo/doc) | ❌ S5 | Drag-and-drop + progresso |
| Textarea expansível | 🔄 | Auto-resize + contagem de caracteres (limite WABA) |
| Status icons em tempo real (webhook delivery) | 🔄 S3 | Meta webhook `statuses` → atualizar `messages.status` |
| **Header chat — breadcrumb pipeline** | ❌ S4 | "Pipeline Alunos › Matrícula › Aguardando documentos" |
| Header chat — gerenciar agente (transferir) | 🔄 | Dropdown atendente → reassign |
| Header chat — ações (Agendar msg / Transferir / Deletar / Snooze) | ❌ | Menu ⋮ com 4 ações |
| **Banner "Janela WABA fechada"** | ❌ S5 | Sobre o input: "Janela de 24h expirou — envie um template" + CTA |
| Modal "Iniciar Conversa" (fila + canal + contato) | ❌ S3 | Search contact + dropdown fila + dropdown canal |
| **Número de ticket sequencial** `#1897217` | ✅ S3 | `ticket_number BIGSERIAL` já existe |
| Painel direito — Aba Informações | 🔄 S3 | Dados básicos, faltam campos custom |
| Painel direito — Aba Histórico | ❌ S4 | Timeline de eventos (stage_transfer, tag_add, note, etc) |
| Painel direito — Aba Negócios | ❌ S4 | Lista de deals vinculados ao contato |
| Painel direito — Aba Protocolos | ❌ S4 | Sub-tickets dentro da conversa |
| Status dos agentes (online/offline/pausado) | ✅ S3 | `agent_statuses`, falta UI renderizando bolinha colorida |
| **Transcrição de áudio com IA** (yH5ysNLTAXE) | ❌ S9 | App habilitável; transcreve áudios recebidos inline |
| **Mensagem fixada** no topo do chat | ❌ | Toggle em mensagem → fixa no topo |
| Responder a uma mensagem específica (quote reply) | ❌ | Ação "Responder" em hover de bubble |
| Reação com emoji a mensagem | ❌ | Hover + picker de emoji |
| Solicitar pagamento via chat (`Lus6OhCWhrg` 04:21) | ❌ S4 | Botão "Solicitar pagamento" → modal valor → gera boleto Inter → envia PDF |
| Grupos WhatsApp (gerenciar via plataforma) | ❌ Fora escopo atual | HelenaCRM integra grupos |

### C. CRM Kanban / Negócios (vídeos `y3CFR97J2Bo`, `N8n8LaxuZLc`, `hu38xgDc-l8`, `ssG53BDi1K0`, `VAa4tqrsFqI`, `g0_lGAnSzdY`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Painéis/Pipelines múltiplos** | ❌ S4 | Criar painel com chave auto (ex: "Comercial" → "COME") |
| Criação de painel com permissão por cargo | ❌ S4 | "Quem pode administrar" / "Quem pode acessar" / "Quem visualiza cards" |
| Opção "Disponível para atendente restrito" | ❌ S4 | Toggle que esconde painel de cargos restritos |
| **Fases/etapas** customizáveis por painel | ❌ S4 | Adicionar/renomear/excluir + cor de atraso |
| Cor de atraso por fase (SLA visual) | ❌ S4 | Card amarelo > X dias, vermelho > Y dias |
| Duplicar estrutura de painel | ❌ S4 | Clone pipeline stages+settings |
| Fixar painel no topo | ❌ S4 | `is_pinned BOOL` na `pipelines` |
| **Kanban** — colunas 300px + drag & drop | ❌ S4 | react-beautiful-dnd ou dnd-kit |
| Horizontal scroll + height calc | ❌ S4 | `calc(100vh - topbar - subtabs)` |
| **Card do deal** | ❌ S4 | Nome contato + telefone + fila + responsável + etapa + valor + tempo na etapa |
| Toggle "Visualizar mensagens nos cards" | ❌ S4 | Mode compact vs preview última mensagem |
| 7 ações rápidas no card (hover ou ⋮) | ❌ S4 | Ver Conversa / Ligar / Trocar agente / Trocar etapa / Adicionar nota / Criar atividade / Arquivar |
| **Menu ⋮ por coluna** (Editar / Transferir / Baixar CSV / Automações) | ❌ S4 | Dropdown na header da coluna |
| Filtros Kanban (Tags / Campanhas / Filas / Período) | ❌ S4 | Pills no topo + chip de filtro ativo |
| Checkboxes rápidos (não lidas / com tarefa pendente) | ❌ S4 | Atalhos de filtro |
| **Lead Detail Modal** (2 colunas — perfil + 4 abas) | ❌ S4 | Modal full-height ao clicar no card |
| Aba Negócios (progresso + cadência + seletor de deal) | ❌ S4 | Barra horizontal de etapas + tarefas a fazer por etapa |
| Aba Atividades (Criar: tipo+responsável+data+duração+nota rich+anexo) | ❌ S4 | Modal com quill/tiptap editor |
| Aba Histórico (log imutável) | ❌ S4 | `deal_history_events` — stage_transfer, note, tag, ticket_transferred, etc |
| Aba Notas (textarea + anexo por deal) | ❌ S4 | `deal_notes` |
| **Central de Atividades** (página dedicada) | ❌ S4 | 4 contadores (Próximas/Hoje/Atrasadas/Concluídas) + filtros Categoria/Status/Tipo |
| **Produtos comerciais** (CRUD Nome+Valor) | ❌ S4 | Vinculáveis a deals para estimar ticket |
| **Protocolos** (sub-ticket dentro de conversa) | ❌ S4 | Número sequencial auto, status, responsável — para FIC isso é "nº do processo" da matrícula |
| Campos customizados por contato (inline no modal) | ❌ S4-S6 | Ex: CPF, nome da mãe, curso, turma |
| **IA Copilot** (prompt → cria pipeline/etapas) | ❌ S10 | Comando natural → agente executa com aprovação (y3CFR97J2Bo 06:20–08:50) |

### D. Contatos / CRM base (vídeos `VAa4tqrsFqI`, `g0_lGAnSzdY`, `TBl14qCjbcM`, `PvfppQNxQZs`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| Tabela com busca + filtro tags | ✅ S1 | UI básica |
| **Cadastro manual de contato** | ❌ S4 | Form (nome/tel/email/tags/custom_fields) |
| **Editar contato** inline | ❌ S4 | Click-to-edit em cada célula |
| **Cor hex por tag** | ❌ S6 | Color picker ao criar tag |
| **Import CSV** (drag-and-drop) | ❌ S6 | Upload → preview → mapping → validação → insert batch |
| **Detecção de duplicatas** (phone normalizado E.164) | ❌ S6 | Flag `has_duplicates` |
| Merge modal (escolher campos canônicos) | ❌ S6 | Lado a lado + radio button por campo |
| **Export CSV** (filtrado por tag/período) | ❌ S6 | Download stream |
| **Ações em massa** (bulk select + bulk delete/tag/fila) | ❌ S6 | Checkbox por linha + actions bar |
| **Campos customizados da empresa** (globais) | ❌ S6 | Admin define "Nome do Campo + Tipo + Obrigatório" — aparece em todo contato |
| Campos customizados do contato (valor) | ❌ S4 | Cada contato preenche |
| **Origem do lead** (tráfego / orgânico / indicação / etc) | ❌ S6 | Campo `source` + relatório de origem (B8E5ab6SATs) |

### E. Agendamentos (vídeos `oOq8AVnwx7g`, `Bm9r57cOqMM`, `JHONOag6fEo`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Calendário Mês/Semana/Dia/Lista** | ❌ S5 | FullCalendar.js ou custom |
| Filtros (responsável / tipo / status) | ❌ S5 | |
| **Mensagem agendada** (tipo + canal + horário + variáveis) | ❌ S5 | WABA/IG/API · `{{primeiroNome}}` etc |
| Worker de disparo (cron Railway ou Vercel Queue) | ❌ S5 | Lê `scheduled_messages WHERE scheduled_at <= now() AND status='pending'` |
| Modo recorrente (diário/semanal/mensal) | ❌ S5 | `scheduled_messages.recurrence JSONB` |
| Tipos: Texto / Imagem / Áudio / **DS Voice** | ❌ S5/S9 | Integração com biblioteca |
| **Evento Google Calendar** (OAuth bidirecional) | ❌ S5+ | Criar evento → sincroniza calendar FIC |
| **Google Meet automático** | ❌ S5+ | Link no evento |
| Lembrete automático (1h antes / 1d antes) | ❌ S5 | `reminders JSONB` |

### F. Templates WABA (vídeos `Olr6prKExSo`, `1lrBXAnV31I`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Grid de templates** (cards preview estilo WhatsApp) | ❌ S5 | Lado esquerdo card de preview, direito metadata |
| 3 categorias (Utilitário / Marketing / Autenticação) | ❌ S5 | Enum + filtro |
| Criar template (form + preview ao vivo) | ❌ S5 | Variáveis `{{1}}`, `{{2}}` ... |
| Botões **Quick Reply** OU CTA (mutuamente exclusivos) | ❌ S5 | Regra de negócio Meta |
| **Status de aprovação** (Rascunho → Pendente → Aprovado / Rejeitado) | ❌ S5 | Sincroniza com Meta a cada N minutos |
| **Sync com Meta API** (GET templates → upsert em `whatsapp_templates`) | ❌ S5 | Cron diário + botão manual |
| Envio de template no chat (quando janela fechada) | ❌ S5 | Modal select template + preenche variáveis |

### G. Automações IF/THEN (vídeos `SHTF1dwAtuc` — etiquetar via chatbot, diversos menções)

| Feature | Status FIC | Detalhe |
|---|---|---|
| Schema `automation_rules` | ✅ S1 | 2 seeds (Financeiro, Matrícula keyword) |
| Execução no webhook processor | 🔄 | Parcial, só keyword matching simples |
| **UI builder visual** (gatilho + condições + ações) | ❌ S8 | Form multi-step ou canvas simples |
| **Gatilhos suportados** | ❌ S8 | `message_received`, `conversation_created`, `status_changed`, `tag_added`, `deal_stage_changed`, `time_elapsed` |
| **Condições encadeáveis** (AND/OR) | ❌ S8 | Chain builder |
| **Ações disponíveis** | ❌ S8 | Atribuir agente, trocar fila, adicionar/remover tag, criar deal, mover etapa kanban, enviar mensagem, disparar n8n, chamar webhook externo, criar atividade |
| Regras específicas por coluna do Kanban | ❌ S8 | "Ao entrar na etapa X, executar Y" |
| **Auto-assign** (menor carga de agente online) | ❌ S8 | Round-robin ponderado |
| Mensagem de boas-vindas (auto-reply primeira mensagem) | ❌ S8 | Já parcial em `queues.greeting_message` |
| Log de execuções (`automation_executions`) | ❌ S8 | Para debug |

### H. Webhooks e API REST pública (vídeos `-W1Gvw7_QzM`, menções em `Lus6OhCWhrg`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Webhook de entrada** (endpoint + tags automáticas) | ❌ S8 | URL única por endpoint + regras (ex: "campo X contém Y → tag Z") |
| **Webhook de saída** (URL + eventos + tentativas) | ❌ S8 | Eventos Comercial (deal.created, deal.stage_changed) + Canal (conversation.assigned, message.received) |
| **API REST pública** | ❌ S8 | Autenticação via `api-key` header + `Connection-Token` por canal |
| Endpoint Mensagens (envio ativo via API) | ❌ S8 | POST `/api/public/v1/messages` |
| Endpoints Dashboard (10 métricas) | ❌ S8 | GET `/api/public/v1/dashboard/*` |
| Endpoints CRM (Contatos / Tickets / Negócios) | ❌ S8 | CRUD |
| Rate limiting e rotação de chaves | ❌ S8 | Redis/Upstash + `api_keys.last_rotated_at` |
| **Integração n8n plugada na fila** (ID 2967 já ativo) | ❌ S8 | Campo `queues.n8n_integration_id` já existe |

### I. Links de Redirecionamento (menção em plano v2)

| Feature | Status FIC | Detalhe |
|---|---|---|
| Slug único rastreável (`/l/xyz`) | ❌ S8 | |
| **4 tipos de distribuição** | ❌ S8 | Sequencial / Aleatório / Ordenado / Por Horário |
| Distribuição multi-canal | ❌ S8 | Pode apontar pra WhatsApp, IG, Messenger |
| `schedule_config JSONB` (horário por agente) | ❌ S8 | |
| Relatório de cliques | ❌ S8 | |

### J. DS Voice — biblioteca de conteúdo (vídeos implícitos em `CDOdwqe_-KE` Sequência + `Olr6prKExSo` Modelo Mensagem)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Biblioteca de Mensagens de texto** | ❌ S9 | CRUD + pastas + variáveis |
| Variáveis `{Nome}` `{Primeiro Nome}` `{Saudação}` etc | ❌ S9 | Parse ao enviar |
| Toggles (ativo / padrão / apenas agentes X) | ❌ S9 | |
| **Biblioteca de Áudios** ≤16MB | ❌ S9 | Upload .mp3/.ogg + toggle "enviar como gravação" (push-to-talk) |
| **Biblioteca de Mídias** (imagens ≤5MB / vídeos ≤100MB) | ❌ S9 | Com caption |
| **Biblioteca de Documentos** ≤100MB | ❌ S9 | Aviso incompatibilidade Instagram |
| **Construtor de Funis / Sequências** | ❌ S9 | Steps ordenados com delay (drip) |
| Duração total calculada | ❌ S9 | Soma delays |
| **Gatilhos de funil** (palavra-chave → dispara) | ❌ S9 | Form condição + funil destino + toggles WABA/IG |
| Export/Import .json (backup) | ❌ S9 | |
| **Ícone DS Voice na toolbar do chat** | ❌ S9 | Modal seleciona item da biblioteca |

### K. DS Agente (IA autônoma) (vídeos `y3CFR97J2Bo`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Integração OpenAI** (GPT-4o ou similar) | ❌ S10 | Via `@ecossistema/credentials` + `@ecossistema/agentes` |
| System prompt por agente | ❌ S10 | Editor textarea + placeholder |
| **RAG** (base de conhecimento FIC) | ❌ S10 | `@ecossistema/rag` — FAQ matrícula, regulamento, grade |
| Parâmetros (temperature, max_tokens=100, max_history=10, delay) | ❌ S10 | |
| **Regras de ativação** (tag E/OU tag → ativa agente) | ❌ S10 | Lógica condicional |
| Toggle "Dividir resposta em blocos" | ❌ S10 | Quebra em múltiplas mensagens naturais |
| Toggle "Processar imagens" (GPT-4o vision) | ❌ S10 | Lê comprovante, documento |
| Toggle "Desabilitar quando agente humano respondeu" | ❌ S10 | Hand-off inteligente |
| **Base de conhecimento** (upload PDFs/DOCs) | ❌ S10 | Ingestion → embeddings Supabase pgvector |
| Widget Home "N agentes ativos · M erros" | ❌ S10 | |
| **BANT qualification flow** (y3CFR97J2Bo) | ❌ S10 | Budget / Authority / Need / Timeline — aplicado a matrícula |
| Follow-up generativo (cadência no-show automática) | ❌ S10 | |

### L. DS Bot — Visual Flow Builder (vídeos `YpFcjGiMw2I` Construtor Avançado + `RFn_fw6wYOw` Ações Fluxo + `Xf6tFnM4va4` Ações Contato + `6RFcmRoD4E0` Ações Mensagem + `AMDg3hbrui0` Ações Atendimento)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Canvas de fluxo** (nodes + edges) | ❌ S10 | React Flow ou similar |
| **Componentes Bubbles** (output) | ❌ S10 | Texto / Imagem / Vídeo / Áudio / Incorporar (iframe) |
| **Componentes Inputs** (coleta) | ❌ S10 | Texto / Número / Email / Website / Data / Telefone / Botão / Arquivo |
| **Ações de Fluxo** | ❌ S10 | Ir para nó / Voltar / Encerrar / Aguardar resposta |
| **Ações de Contato** | ❌ S10 | Adicionar/remover tag / Atualizar campo custom / Mover etapa pipeline |
| **Ações de Mensagem** | ❌ S10 | Enviar template WABA / Enviar item biblioteca DS Voice / Encaminhar |
| **Ações de Atendimento** | ❌ S10 | Transferir fila / Atribuir agente / Abrir protocolo / Fechar conversa |
| **3 formas de criar** | ❌ S10 | Do zero / Modelo / Importar JSON |
| Versioning (draft → publish) | ❌ S10 | |
| Testar fluxo em sandbox | ❌ S10 | Chat fake |
| **Vincular bot a fila/canal** | ❌ S10 | Campo `queues.ds_bot_id` ou `queues.ds_agent_id` |

### M. Chat Interno (team chat) (menção em plano v2 + `X115LzVAliA`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| 2 painéis (lista conversas + chat) | ❌ S8 | Supabase Realtime |
| Grupos e DMs | ❌ S8 | `team_chats` + `team_chat_members` |
| Mensagens em tempo real | ❌ S8 | |
| Anexos | ❌ S8 | |
| Menções @agente | ❌ S8 | |

### N. Relatórios / Dashboards (vídeos `dNaKezWr_LY`, `0_0i72W2s68`, `t2bF8-5uui8`, `olMQTujz724`, `iTuVYvn347I`, `B8E5ab6SATs`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **6 tipos de relatório** | ❌ S7 | Vendas / Atividades / Conversas / Ligações / SDR / Closer |
| **3 abas Indicadores** | ❌ S7 | Resultados / Usuários / Geral |
| Aba Resultados — taxa fechamento, ticket médio, total vendas | ❌ S7 | |
| Aba Usuários — ranking agentes por métrica | ❌ S7 | |
| Aba Geral — visão consolidada | ❌ S7 | |
| Filtros (Data range / Usuário / Tipo) | ❌ S7 | |
| **Gráficos customizáveis** (modal "Adicionar Gráfico") | ❌ S7 | ApexCharts (barras/linhas/pie) |
| **Exportação origem leads** (B8E5ab6SATs) | ❌ S7 | CSV agrupado por `source` |
| Job diário (cron) → `metrics_snapshots` | ❌ S7 | Agregação noturna |
| **NPS e tempo médio de resposta** | ❌ S7 | Específicos atendimento |
| Widgets externos incorporados (iframe com `{{user.email}}`) | ❌ S7 | Para plugar Metabase, Power BI, Looker Studio |

### O. Usuários / Cargos / Permissões (vídeos `-LctSvm1Mzo`, `LsdXRmS7Agk`, `_KeeL_5wG5k`, `XWd-0Gj6R6E`, `XdikJZkmY7Q`)

| Feature | Status FIC | Detalhe |
|---|---|---|
| Schema `agents` | ✅ S1 | |
| **3 níveis visto em Lus6OhCWhrg**: Administrador / Atendimento / Atendimento restrito | ❌ S6 | Presets de cargo |
| **Cargos customizáveis** (agent_roles + role_permissions) | ❌ S6 | |
| **13 módulos de permissão** (granular) | ❌ S6 | Dashboard, Conversas, Contatos, CRM/Pipelines, Agendamentos, Templates, Automações, Webhooks, Canais, Usuários, Cargos, DS Voice, DS Agente/Bot, Relatórios, Configurações |
| Cada módulo: Ver / Criar / Editar / Deletar / Exportar | ❌ S6 | Matrix permissions |
| **Convite de usuário por email** | ❌ S6 | Link mágico Supabase Auth |
| **Equipes/Grupos** (vídeos `HYKeZWyBCwY`, `wgsaW6I9KIM`) | ❌ S6 | Agrupar agentes por departamento |
| Agente pausado (pause_reason enum) | ✅ S3 | UI a renderizar |

### P. Canais (vídeos `oGs_ByuGDWc` Z-API, `QlGUrIGjc44` Instagram)

| Feature | Status FIC | Detalhe |
|---|---|---|
| Lista de canais cadastrados | ✅ S1 | |
| **Card de canal** (logo provider + status + número + ações) | 🔄 | |
| Cadastrar WABA Meta Cloud | 🔄 S2 | Manual via SQL hoje — UI em S6 |
| **Conectar Instagram** (OAuth Meta) | ❌ S6 | Graph API + Page ID |
| Conectar Email (IMAP/SMTP) | ❌ S8+ | |
| Conectar SMS (provedor brasileiro ou Twilio) | ❌ S8+ | |
| **Webhook de sincronização** por canal | ✅ | Meta configurado |
| Horário de atendimento por canal (`working_hours JSONB`) | 🔄 Schema | UI em S6 |
| **Mensagem de boas-vindas / ausência** por canal | 🔄 Schema | UI em S6 |
| Teste de envio (botão "Enviar mensagem teste") | ❌ S5 | |

### Q. Campanhas (vídeos `VCsSLNj7vzE` — 90 timestamps, mais longo)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **CRUD de campanhas** | ❌ S4 | Nome + descrição + público-alvo + canal + template |
| Público-alvo (filtro de contatos: tags/pipeline/período) | ❌ S4 | |
| **Disparo em massa** (respeita rate limit WABA) | ❌ S5 | Worker Railway com queue |
| Relatório por campanha (enviados/entregues/lidos/respondidos/opt-out) | ❌ S7 | |
| Vincular campanha a deal/contato | ❌ S4 | Campo `deals.campaign_id` |

### R. Integrações / Apps (vídeos `oGs_ByuGDWc` Custos Z-API)

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Página "Apps"** (grid de integrações habilitáveis) | ❌ S8 | Cada app: habilitar/desabilitar + config |
| Config por app (JSON customizável) | ❌ S8 | `app_installations` |
| App: Transcrição de áudio com IA | ❌ S9 | |
| App: Google Calendar | ❌ S5 | |
| App: Meta ADS Tracking (DS Track) | ⏭️ Fora escopo | |

### S. Configurações gerais (vídeo `S1liAttRAtw` Perfil Parceiro, `bvpz84EThEU` Customização)

| Feature | Status FIC | Detalhe |
|---|---|---|
| Perfil do usuário (avatar, nome, senha) | 🔄 | Usa Supabase Auth |
| **Configurações da conta** (`account_settings`) | ❌ S6 | Moeda, Fuso, Horário comercial, Feriados |
| Saudação automática (ao aceitar / transferir) | ❌ S8 | |
| Sincronizar responsável conversa ↔ negócio | ❌ S4 | Toggle |
| Restringir visualização de histórico | ❌ S6 | Toggle por cargo |
| Logotipo e identidade (para futuro multi-tenant) | ❌ Fase 2 | Prep white-label |

### T. Painel Parceiro / Whitelabel (11 vídeos "[Parceiros]")

| Feature | Status FIC | Detalhe |
|---|---|---|
| **Gestão de usuários admin** (XdikJZkmY7Q) | ❌ Fase 4 | Se virar SaaS |
| **Relatórios de faturamento** (db54n8_3_Sg) | ❌ Fase 4 | |
| **Canal de demonstração** (-X2jMXU_zos) | ❌ Fase 4 | |
| **Ações e menus personalizados** (jbgM0hgvTPc) | ❌ Fase 4 | White-label do menu |
| **Configuração conta demo** (0I1UH-wIA2s) | ❌ Fase 4 | |
| **Criação de conta (onboarding)** (t1aj8gLs9cI) | ❌ Fase 4 | |
| **Início da cobrança** (G0XsZWjQV8c) | ❌ Fase 4 | |
| **Customização White Label** (bvpz84EThEU) — logos, cores, textos de login | ❌ Fase 4 | Submenus: Detalhes / Apps / Imagens / Documentação / Integração |
| **Planos e funcionalidades** (qrRvyH0k6l8) | ❌ Fase 4 | Feature gating por plano |
| **Criação de página no Facebook** (-W1Gvw7_QzM) | ❌ Fase 4 | Guia para novos parceiros |
| **Panorama do perfil** (S1liAttRAtw) | ❌ Fase 4 | Dashboard do parceiro |
| **Tokens de parceiro** | ❌ Fase 4 | API para automações de conta |

---

# Parte 3 — Arquitetura alvo

## 3.1 Visão sistêmica (como o atendimento conversa com o resto do ERP)

```
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp (Meta) · Instagram · Email · SMS · API · Widget web  │
└────────────────────────────┬────────────────────────────────────┘
                             │ (webhooks entrada)
        ┌────────────────────▼────────────────────┐
        │  /api/atendimento/webhook               │
        │  + Automation engine (pre-processing)   │
        │  + Contact upsert + Label auto-apply    │
        └────────────────────┬────────────────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    ▼                        ▼                        ▼
┌─────────┐          ┌──────────────┐        ┌──────────────┐
│ Filas   │──(dist)──│  Conversations│←──────│  Deals       │
│ (queue) │          │  + Messages   │       │  (pipeline)  │
└────┬────┘          └──────┬────────┘       └──────┬───────┘
     │                      │                       │
     │                      ▼                       │
     │              ┌──────────────┐                 │
     │              │  DS Agente   │←─RAG FIC────────┼──┐
     │              │  DS Bot      │                 │  │
     │              └──────────────┘                 │  │
     │                                               │  │
     └──► Inbox UI ◄── Painel Atendente ──► Kanban ──┘  │
                                                        │
    ┌───────────────────────────────────────────────────┘
    │ (saídas para ecossistema)
    ▼
┌─────────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────┐
│ Alunos /    │   │ Financeiro  │   │ Diploma      │   │ n8n     │
│ Matrícula   │   │ (Inter)     │   │ Digital      │   │ ID 2967 │
└─────────────┘   └─────────────┘   └──────────────┘   └─────────┘
```

**Pontos de integração com o ERP:**
1. `contacts.aluno_id FK → alunos` — o contato vira aluno quando matricula
2. Deal `source='WhatsApp Matrícula'` → ao chegar na etapa "Aprovado" → **trigger automático** cria registro em `alunos` + abre processo `diploma_pipeline`
3. "Solicitar pagamento" no chat → chama `@ecossistema/billing` → gera boleto Inter → envia PDF no WhatsApp
4. Protocolo de conversa = número de processo acadêmico (mantém rastreabilidade)
5. DS Agente responde dúvidas de aluno com **contexto do RAG da FIC** (regulamento, grade, calendário) + estado no ERP (aluno X tem mensalidade atrasada? está em qual semestre?)

## 3.2 Stack técnica

| Camada | Tecnologia | Versão | Decisão |
|---|---|---|---|
| Frontend | Next.js App Router | 15+ (Node 24 LTS) | ✅ canonical V4 |
| UI components | shadcn/ui + Radix + Tailwind v4 | última | Substitui MUI v4 do Nexvy (mais moderno, bundle menor) |
| Drag & drop | `@dnd-kit` | v6 | Kanban S4 |
| Canvas (DS Bot) | `@xyflow/react` (React Flow) | v12 | S10 |
| Rich editor | TipTap | v2 | Notas/atividades |
| Charts | Recharts ou Tremor | última | Relatórios S7 |
| State | Server Actions + TanStack Query | v5 | |
| Realtime | Supabase Realtime | | Chat + kanban live |
| Backend API | Next.js Route Handlers (Fluid Compute) | | Deploy Vercel — Fluid habilitado |
| Worker/cron | Vercel Queues (public beta) OU Railway worker | | Para disparo agendado S5 + sync Meta S5 + metrics S7 |
| Database | Supabase Postgres (ECOSYSTEM + ERP) | | Multi-project connection via `@ecossistema/credentials` |
| Filas internas | pg_cron + `dual_write_queue` pattern | | Sem Redis por enquanto |
| IA | OpenAI GPT-4o + Anthropic Claude (DS Agente) | | Via `@ecossistema/agentes` |
| Embeddings | Supabase pgvector + OpenAI `text-embedding-3-small` | | RAG S10 |
| File storage | Vercel Blob (público) + Supabase Storage (privado) | | Uploads, mídia DS Voice |
| Transcrição áudio | Gemini 2.5 Flash ou Whisper | | App S9 |
| Auth | Supabase Auth + RLS | | Com cargos customizáveis S6 |
| Credenciais | `@ecossistema/credentials` (SC-29 Vault) | | Tokens Meta/n8n/OpenAI protegidos |

**Por que desviar do Nexvy em stack:**
- Eles usam MUI v4 (JSS, desatualizado). Nós usamos shadcn/ui + Tailwind v4 (ergonomia melhor, dark mode nativo, menor bundle)
- Design tokens preservados idênticos → visualmente indistinguível para quem já usa Nexvy

## 3.3 Estratégia de multi-tenancy

**Regra única:** toda tabela atendimento_* tem `account_id UUID NULL`.

- **Fase 1-3 (FIC only):** `account_id = NULL` em tudo · RLS permissivo `auth.role() = 'authenticated'`
- **Fase 4 (SaaS):** migration `account_id NOT NULL DEFAULT fic_account_id` · RLS `account_id = (auth.jwt() ->> 'account_id')::uuid`

Zero refactor no código de aplicação — só mudança de RLS + middleware injeta `account_id` no JWT.

## 3.4 Fluxo de dados crítico: recepção de mensagem WABA

```
1. Meta POST → /api/atendimento/webhook
2. Verifica X-Hub-Signature-256 (HMAC WHATSAPP_APP_SECRET)
3. Parse payload.entry[0].changes[0].value
4. For each message:
   a. Upsert `contacts` por phone_number_e164
   b. Get or create `conversations` (by contact_id + inbox_id)
      - Se nova → aplicar fila default + executar automation_rules 'conversation_created'
   c. Insert `messages` (message_type='incoming', status='read' implícito)
   d. Trigger auto: update conversations.last_activity_at + unread_count
   e. Run automation_rules WHERE event_name='message_created'
      - Match keyword → tag automática
      - Se DS Agente ativo → enqueue agent job
   f. Broadcast Supabase Realtime → frontend atualiza lista
5. For each status (delivered/read/failed):
   a. Update messages.status WHERE channel_message_id = wamid
   b. Broadcast Realtime
```

**Pontos críticos a reforçar em S4+:**
- Media download real (hoje só salva URL) → download do Meta + upload pra Vercel Blob
- Idempotência por `messages_channel_message_id_unique`
- Retry em falha do Meta via `dual_write_queue`

---

# Parte 4 — Roadmap por Sprints (S4 → S10+)

**Premissa:** 1 sprint = 1 semana útil. Cada sprint entrega deploy em produção com feature flag se necessário.

## Sprint S4 — CRM Kanban + Lead Detail + Protocolos (🎯 próximo)

**Meta:** Kanban do ATENDIMENTOS-GERAL da FIC migrado do Nexvy para o ERP, com drag-and-drop, lead detail completo e protocolos funcionando.

### Entregas

**DB Migrations (`20260421_atendimento_s4_kanban.sql`):**
```sql
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NULL,
  key VARCHAR(32) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color_hex VARCHAR(7),
  is_pinned BOOL DEFAULT false,
  admin_role_ids UUID[],      -- quem pode administrar
  access_role_ids UUID[],     -- quem pode acessar
  cards_visibility VARCHAR DEFAULT 'owner',  -- 'all' | 'owner' | 'team'
  visible_to_restricted BOOL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL,
  color_hex VARCHAR(7),
  sla_warning_days INT,      -- amarelo após X dias
  sla_danger_days INT,       -- vermelho após Y dias
  is_won BOOL DEFAULT false, -- etapa final de sucesso
  is_lost BOOL DEFAULT false -- etapa final de falha
);

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NULL,
  pipeline_id UUID REFERENCES pipelines,
  stage_id UUID REFERENCES pipeline_stages,
  contact_id UUID REFERENCES atendimento_contacts,
  assignee_id UUID,
  queue_id UUID REFERENCES atendimento_queues,
  campaign_id UUID,  -- FK futuro em S4 também
  title VARCHAR(200),
  value_cents BIGINT,
  currency VARCHAR(3) DEFAULT 'BRL',
  source VARCHAR,
  custom_fields JSONB DEFAULT '{}',
  entered_stage_at TIMESTAMPTZ DEFAULT NOW(),
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals ON DELETE CASCADE,
  type VARCHAR,  -- call/meeting/task/email/whatsapp
  title VARCHAR(200),
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  assignee_id UUID,
  completed_at TIMESTAMPTZ,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals ON DELETE CASCADE,
  author_id UUID,
  body TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_history_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals ON DELETE CASCADE,
  actor_id UUID,
  event_type VARCHAR,  -- stage_transfer/note_added/tag_added/ticket_transferred/etc
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES atendimento_conversations,
  protocol_number BIGSERIAL,
  subject VARCHAR(200),
  status VARCHAR DEFAULT 'open',  -- open/resolved/canceled
  assignee_id UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NULL,
  name VARCHAR(200),
  description TEXT,
  audience_filter JSONB,  -- tags, pipeline, period
  channel VARCHAR,
  template_id UUID,
  status VARCHAR DEFAULT 'draft',  -- draft/scheduled/running/done
  scheduled_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{}',  -- sent/delivered/read/replied
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_custom_fields (
  contact_id UUID REFERENCES atendimento_contacts ON DELETE CASCADE,
  field_key VARCHAR(64),
  field_value TEXT,
  PRIMARY KEY (contact_id, field_key)
);

ALTER TABLE atendimento_conversations ADD COLUMN deal_id UUID REFERENCES deals;
ALTER TABLE atendimento_conversations ADD COLUMN protocol_count INT DEFAULT 0;
ALTER TABLE atendimento_contacts ADD COLUMN aluno_id UUID;  -- FK futuro
ALTER TABLE atendimento_contacts ADD COLUMN source VARCHAR;
ALTER TABLE atendimento_contacts ADD COLUMN color_hex VARCHAR(7);

-- Seed pipelines FIC
INSERT INTO pipelines (key, name, description, is_pinned, sort_order) VALUES
  ('ATND',  'ATENDIMENTOS-GERAL', 'Pipeline principal de atendimentos da FIC', true, 0),
  ('ALUN',  'Alunos', 'Pipeline de matrícula e jornada do aluno', false, 1);

-- Seed stages ATENDIMENTOS-GERAL (4 etapas reais FIC)
INSERT INTO pipeline_stages (pipeline_id, name, sort_order, color_hex, sla_warning_days) VALUES
  ((SELECT id FROM pipelines WHERE key='ATND'), 'AGUARDANDO', 0, '#98A2B3', 2),
  ((SELECT id FROM pipelines WHERE key='ATND'), 'SECRETARIA', 1, '#345EF3', 3),
  ((SELECT id FROM pipelines WHERE key='ATND'), 'FINANCEIRO', 2, '#F79009', 5),
  ((SELECT id FROM pipelines WHERE key='ATND'), 'NOVAS MATRÍCULAS', 3, '#12B76A', 7);

-- Seed stages Alunos (7 etapas sugeridas)
INSERT INTO pipeline_stages (pipeline_id, name, sort_order, color_hex, sla_warning_days) VALUES
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Interesse',       0, '#98A2B3', 3),
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Visita',          1, '#345EF3', 7),
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Documentação',    2, '#F79009', 10),
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Financeiro',      3, '#F79009', 5),
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Matrícula ativa', 4, '#12B76A', NULL),
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Cursando',        5, '#12B76A', NULL),
  ((SELECT id FROM pipelines WHERE key='ALUN'), 'Formado',         6, '#0BA5EC', NULL);
```

**Frontend:**
- `/atendimento/crm` (nova rota substituindo dashboard genérico)
- `KanbanBoard.tsx` — colunas draggable com `@dnd-kit`
- `DealCard.tsx` — card com modo compact/preview
- `LeadDetailModal.tsx` — 2 colunas + 4 abas (Negócios/Atividades/Histórico/Notas)
- `DealActivityEditor.tsx` — TipTap rich editor + anexo
- `ProtocolModal.tsx` — abrir protocolo dentro de uma conversa
- `PipelineSelector.tsx` — drawer 480px lateral
- `StageColumnMenu.tsx` — menu ⋮ por coluna (Editar/Transferir/CSV/Automações)

**Backend:**
- `GET/POST/PATCH /api/atendimento/pipelines`
- `GET /api/atendimento/pipelines/[id]/deals?stage=X&filters=...`
- `PATCH /api/atendimento/deals/[id]` (mover etapa dispara trigger history)
- `POST /api/atendimento/deals/[id]/activities`
- `POST /api/atendimento/deals/[id]/notes`
- `POST /api/atendimento/conversations/[id]/protocols`

**Screenshots de referência no benchmark:**
- `docs/research/nexvy-whitelabel/y3CFR97J2Bo/` — visão geral CRM (109 frames)
- `docs/research/nexvy-whitelabel/hu38xgDc-l8/` — painel criação passo a passo
- `docs/research/nexvy-whitelabel/ssG53BDi1K0/` — cards no CRM (40 frames)
- `docs/research/nexvy-whitelabel/VAa4tqrsFqI/` — cadastrar contatos (58 frames)
- `docs/research/nexvy-whitelabel/g0_lGAnSzdY/` — consultar/editar (43 frames)

**Critério de aceite:**
- Marcelo consegue migrar as 171 deals reais do Nexvy para o ERP via import CSV
- Arrastar card entre colunas persiste no DB e gera evento em `deal_history_events`
- Abrir conversa no chat mostra breadcrumb "Pipeline X › Etapa Y" clicável
- Criar atividade com agendamento aparece na Central de Atividades

**Risco:** drag-and-drop performance com 171+ cards por coluna → virtualizar com `react-virtuoso`.

---

## Sprint S5 — Templates WABA + Agendamentos + Envio Ativo

**Meta:** FIC consegue disparar template WABA aprovado pela Meta + agendar mensagens recorrentes + integrar Google Calendar.

### Entregas

**DB:**
- Expandir `atendimento_whatsapp_templates` com todos os campos (`has_buttons`, `button_type`, `language_code`, `rejected_reason`)
- `scheduled_messages` (contact_id/template_id/scheduled_at/recurrence_rule/status)
- `calendar_events` (google_event_id + refresh_token)

**Frontend:**
- `/atendimento/templates` — grid cards preview
- `TemplatePreview.tsx` — mockup WhatsApp real com bubbles
- `TemplateEditor.tsx` — form 3-step (categoria → componentes → botões)
- `/atendimento/agendamentos` — calendário (mês/semana/dia/lista)
- `ScheduleModal.tsx` — tipo/canal/contato/template/horário
- Banner "Janela WABA fechada" no chat → abre modal `SelectTemplateModal`

**Backend:**
- Worker `syncMetaTemplates` (Vercel Queues ou Railway cron a cada 30min)
- `POST /api/atendimento/templates/[id]/send` (envia template direto)
- `POST /api/atendimento/scheduled-messages` + worker `processScheduledMessages`
- `GET /auth/google/connect` + OAuth callback → salva refresh_token em `@ecossistema/credentials`
- `POST /api/atendimento/calendar-events` (cria evento Google)

**Referências do benchmark:**
- `oOq8AVnwx7g/` configuração mensagens agendadas
- `Bm9r57cOqMM/` mensagens agendadas na prática
- `Olr6prKExSo/` modelo mensagem
- `1lrBXAnV31I/` contexto modelos

**Dependência externa:** Marcelo precisa **criar 1º template WABA na Meta** e aguardar aprovação (24-48h) antes de começar envio ativo.

---

## Sprint S6 — Contatos completo + Cargos/Permissões + Configurações

**Meta:** CRM de contatos pronto para a Secretaria usar no dia-a-dia + sistema de permissões granular para os 4 agentes FIC.

### Entregas

**DB:**
- `contact_company_custom_fields` (campos globais), `saved_views`, `agent_roles`, `role_permissions`, `account_settings`
- Migration de seeds: 3 cargos padrão (Admin, Atendente, Atendente restrito), permissions matrix baseada nas 13 categorias

**Frontend:**
- `/atendimento/contatos` — reforma com bulk actions, import/export CSV, color tags, merge de duplicatas
- `CustomFieldsEditor.tsx` (admin define campos globais)
- `SavedViewModal.tsx` (criar aba customizada)
- `/atendimento/configuracoes/usuarios` — CRUD + convite
- `/atendimento/configuracoes/cargos` — editor visual de permissões
- `/atendimento/configuracoes/geral` — horário comercial, saudação automática, etc

**Backend:**
- `/api/atendimento/contacts/import` (parse CSV → validação → upsert batch)
- `/api/atendimento/contacts/merge` (modal de seleção de campo canônico)
- `/api/atendimento/roles` + `/api/atendimento/roles/[id]/permissions`
- Middleware `requirePermission('module', 'action')` em todas as rotas sensíveis

**Referências:**
- `TBl14qCjbcM/` campo personalizado (33 frames)
- `PvfppQNxQZs/` importar contatos (19 frames)
- `-LctSvm1Mzo/`, `LsdXRmS7Agk/` usuários conceitos (24 frames total)
- `_KeeL_5wG5k/` equipes (17 frames)
- `XWd-0Gj6R6E/` permissões (12 frames)

---

## Sprint S7 — Dashboards, Relatórios, Widgets

**Meta:** Diretoria FIC consegue abrir o atendimento e ver em 5s o pulso do mês.

### Entregas

**DB:**
- `metrics_snapshots` (daily aggregation — 20+ métricas por dia)
- `widgets` (URLs externas com `{{user.email}}` etc)
- `report_definitions` (gráficos customizáveis salvos)

**Frontend:**
- `/atendimento` (home) — 6 widgets (Canais / CRM / Conversas / Atividades / Agentes IA / Widget config)
- `/atendimento/relatorios` — 6 tipos relatório (Vendas/Atividades/Conversas/Ligações/SDR/Closer) + 3 abas Indicadores
- `ReportBuilder.tsx` — adicionar gráfico customizado
- `WidgetFrame.tsx` — iframe com token

**Backend:**
- Worker `aggregateMetricsDaily` (cron 02:00 BRT)
- `/api/atendimento/reports/[type]?from=X&to=Y&user=Z`
- `/api/atendimento/widgets/[id]/token` (gera JWT curto para iframe)

**Referências:**
- `dNaKezWr_LY/` relatórios (10 frames)
- `0_0i72W2s68/` aba Resultados (9 frames)
- `t2bF8-5uui8/` aba Usuários (23 frames)
- `olMQTujz724/` aba Geral (39 frames)
- `iTuVYvn347I/` panorama (15 frames)
- `B8E5ab6SATs/` origem leads (31 frames)

---

## Sprint S8 — Automações + Webhooks + API REST + n8n + Chat Interno + Links

**Meta:** FIC pluga o n8n ID 2967 no ERP + equipe usa chat interno para alinhar atendimentos + API pública pronta para integradores.

### Entregas

**DB:**
- `webhook_inbound_endpoints`, `webhook_outbound_urls`, `webhook_attempts` (para retry)
- `automation_executions` (log de regras executadas)
- `link_redirects` (slug + distribution_config JSONB)
- `api_keys` (hash + scopes + last_rotated_at)
- `team_chats`, `team_chat_members`, `team_messages`

**Frontend:**
- `/atendimento/automacoes` — builder visual (gatilho + condições + ações)
- `/atendimento/webhooks` — Entrada / Saída com teste ao vivo
- `/atendimento/integracoes` — página "Apps" + config n8n
- `/atendimento/api-keys` — gerar/rotacionar
- `/atendimento/links-redirecionamento` — CRUD
- `/atendimento/chat-interno` — 2 painéis Realtime

**Backend:**
- `/api/atendimento/webhooks/inbound/[slug]` (público, sem auth)
- Dispatcher webhook saída (retry exponencial)
- `/api/public/v1/*` — Messages, Dashboard (10 endpoints), CRM Contacts/Tickets/Deals
- Autenticação: header `api-key` + `Connection-Token`

**Referências:**
- `SHTF1dwAtuc/` etiquetar via chatbot (24 frames)
- `X115LzVAliA/` chat interno (18 frames)
- `VCsSLNj7vzE/` campanhas (90 frames — também entra aqui parcialmente)

---

## Sprint S9 — DS Voice (biblioteca de conteúdo)

**Meta:** Atendentes FIC não digitam mais do zero — usam biblioteca de textos/áudios/mídias com variáveis.

### Entregas

- 8 tabelas `ds_voice_*`
- CRUD + UI + pastas
- Funis (drip sequences com delay)
- Gatilhos (keyword → dispara funil)
- Integração no chat (ícone na toolbar)
- Integração em agendamentos (tipo DS Voice)
- App "Transcrição de áudio com IA" (habilita transcrição automática via Gemini/Whisper)

**Referências:**
- `CDOdwqe_-KE/` sequência (78 frames)
- `yH5ysNLTAXE/` transcrição áudio (16 frames)

---

## Sprint S10 — DS Agente + DS Bot (IA autônoma)

**Meta:** DS Agente responde dúvidas de matrícula 24/7 com contexto do aluno + DS Bot qualifica leads antes do humano.

### Entregas

- `ds_agents` + integração OpenAI + RAG (`@ecossistema/rag`)
- Base de conhecimento FIC (regulamento, FAQ matrícula, grade curricular) — ingestion pipeline
- `ds_bots` + editor React Flow + componentes Bubbles/Inputs/Actions
- Regras de ativação por tag
- Hand-off humano (desabilita bot quando agente responder)
- Widget home "N agentes ativos · M erros"
- IA Copilot (comando natural → ação no sistema — visto em `y3CFR97J2Bo`)

**Pré-requisitos:** RAG engine Railway funcionando + `@ecossistema/agentes` integrado.

---

## Fase 4 (paralela, condicional)

- Multi-tenant real (migration `account_id NOT NULL`)
- Painel Parceiro (white-label interface)
- Sistema de planos e cobrança (integrar Inter)
- Onboarding de novos clientes
- Sign up público
- Customização de logos/cores por tenant

**Trigger:** Marcelo decide que Klésis (outro negócio dele) ou terceiros vão usar. Até lá, foco em FIC.

---

# Parte 5 — Design system prático

## 5.1 Estrutura de pastas a criar

```
apps/erp-educacional/src/
├── components/
│   ├── atendimento/
│   │   ├── inbox/
│   │   │   ├── ConversasList.tsx        [EXISTE]
│   │   │   ├── ChatPanel.tsx            [EXISTE]
│   │   │   ├── ContactInfoPanel.tsx     [EXISTE]
│   │   │   ├── MessageBubble.tsx        [EXISTE]
│   │   │   ├── ChatToolbar.tsx          [S5 — 5 tipos]
│   │   │   ├── ClosedWindowBanner.tsx   [S5]
│   │   │   └── StartConversationModal.tsx [S3-S4]
│   │   ├── kanban/                       [S4]
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── DealCard.tsx
│   │   │   ├── StageColumn.tsx
│   │   │   ├── PipelineSelector.tsx
│   │   │   └── LeadDetailModal.tsx
│   │   ├── contatos/                     [S6]
│   │   │   ├── ContactTable.tsx
│   │   │   ├── ImportCSVModal.tsx
│   │   │   └── MergeDuplicatesModal.tsx
│   │   ├── templates/                    [S5]
│   │   ├── agendamentos/                 [S5]
│   │   ├── automacoes/                   [S8]
│   │   ├── ds-voice/                     [S9]
│   │   ├── ds-agente/                    [S10]
│   │   ├── ds-bot/                       [S10]
│   │   └── shared/
│   │       ├── QueueBadge.tsx            [cor + nome da fila]
│   │       ├── AgentStatusDot.tsx        [verde/cinza/laranja]
│   │       ├── TicketNumberPill.tsx      [#1897217]
│   │       └── BreadcrumbPipeline.tsx    [Pipeline › Etapa]
```

## 5.2 Convenções de nomenclatura (alinhadas ao Nexvy para reduzir fricção cognitiva)

| Conceito | Termo FIC (usar) | Termo técnico DB |
|---|---|---|
| Conversa | "Atendimento" ou "Conversa" | `conversation` |
| Ticket ID | "Protocolo" ou "Ticket" | `ticket_number` (sequencial) |
| Sub-processo | "Protocolo" | `protocol` |
| Etiqueta | "Tag" | `label` |
| Fila | "Fila" | `queue` |
| Agente | "Atendente" | `agent` |
| Pipeline | "Pipeline" ou "Painel" | `pipeline` |
| Etapa | "Etapa" ou "Fase" | `stage` |
| Deal | "Negócio" | `deal` |
| Template WABA | "Modelo de Mensagem" | `whatsapp_template` |

## 5.3 Padrões de UI críticos

**Chat bubble (igual WhatsApp):**
```tsx
// Incoming (cliente)
<div className="bg-white rounded-tr-lg rounded-b-lg rounded-tl-none shadow-sm max-w-[70%] p-3 ml-2">
  <p className="text-sm text-slate-900">{content}</p>
  <time className="text-[11px] text-slate-400">{time}</time>
</div>

// Outgoing (agente)
<div className="bg-[#DCF8C6] rounded-tl-lg rounded-b-lg rounded-tr-none shadow-sm max-w-[70%] p-3 mr-2 ml-auto">
  <p className="text-sm">{content}</p>
  <div className="flex items-center gap-1">
    <time className="text-[11px] text-slate-500">{time}</time>
    <StatusIcon status={status} />
  </div>
</div>
```

**Status icons (Meta padrão):**
- `pending` → ⏱️ cinza
- `sent` → ✓ cinza
- `delivered` → ✓✓ cinza
- `read` → ✓✓ azul `#345EF3`
- `failed` → ⚠️ vermelho

**Badge de fila (cor + nome):**
```tsx
<Badge style={{ backgroundColor: queue.color_hex + '20', color: queue.color_hex }}>
  {queue.name}
</Badge>
```

---

# Parte 6 — Como usar o acervo de pesquisa (as 5 sugestões em ação)

## Sugestão 1 — Decisão de escopo baseada em must/nice/diferencial

**Antes de aprovar cada sprint**, o time abre `PLANO-LEVANTAMENTO-NEXVY.md` (no worktree) OU este documento e classifica cada feature em:

- 🔴 **Must-have**: paridade funcional com helenaCRM (sem isso a FIC não migra)
- 🟡 **Nice-to-have**: feature esperada mas que podemos simplificar
- 🟢 **Diferencial**: nenhum concorrente tem, nosso ganho competitivo

**Exemplo aplicado ao S4:**
- 🔴 Kanban, Lead Detail 4 abas, mover deal entre etapas, protocolos → must
- 🟡 Toggle visualizar mensagens nos cards, menu ⋮ por coluna → nice
- 🟢 Breadcrumb que conecta Kanban ↔ Chat ↔ Registro Aluno → diferencial (nenhum concorrente tem esse loop no educacional)

## Sugestão 2 — Design tokens como baseline único

**Regra:** nenhum componente novo hard-codea cores/fontes. Tudo passa por `tailwind.config.ts` com as tokens da Parte 2.2.

**Ação imediata S4 dia 1:**
1. Abrir `apps/erp-educacional/tailwind.config.ts`
2. Adicionar todas as tokens da Parte 2.2 em `theme.extend`
3. Criar um `storybook` (ou página `/dev/tokens`) que renderiza toda a paleta para validar visualmente

## Sugestão 3 — Referência visual em dois níveis

**Nível 1 — Screenshots navegados (`screenshots/`):**
- 225 PNGs nomeados por data (Captura de Tela 2026-04-19 às HH.MM.SS.png)
- Buscar por tela: `ls docs/research/nexvy-whitelabel/screenshots/ | head -20`

**Nível 2 — Frames extraídos por vídeo (`<video-id>/frame_*.jpg`):**
- Cada frame tem timestamp + descrição Gemini
- Abrir README.md da pasta do vídeo relevante

**Quando usar cada:**
- Screenshot: "como é a tela de criar fila?" → pegar PNG
- Frame: "mostre-me passo a passo o fluxo de criar painel" → README.md do vídeo hu38xgDc-l8

## Sugestão 4 — Grep para achar onde cada feature é explicada

**Exemplo real:**
```bash
# Achar todas as menções a "campo personalizado"
grep -ril "campo personalizado" docs/research/nexvy-whitelabel/*/transcricao.txt

# Achar vídeo que explica distribuição sequencial
grep -l "sequencial" docs/research/nexvy-whitelabel/*/timestamps.txt

# Achar exatos timestamps sobre janela WABA
grep -n "janela" docs/research/nexvy-whitelabel/*/transcricao.txt
```

**Comando útil para o time:**
```bash
# Busca por tópico em todos os vídeos — retorna vídeo + trecho relevante
search_benchmark() {
  local term="$1"
  for vid in docs/research/nexvy-whitelabel/*/transcricao.txt; do
    match=$(grep -ni "$term" "$vid" | head -3)
    [ -n "$match" ] && echo "=== $(dirname $vid) ===" && echo "$match"
  done
}
```

Salvar em `apps/erp-educacional/scripts/search_benchmark.sh` para uso recorrente.

## Sugestão 5 — Vídeos Parceiros como gabarito de Painel Parceiro

**11 vídeos "[Parceiros]"** = tudo que precisamos saber para Fase 4 (multi-tenant):

| Feature multi-tenant | Vídeo gabarito |
|---|---|
| Criar conta de tenant | `t1aj8gLs9cI/` (34 frames) |
| Onboarding (conta demo) | `0I1UH-wIA2s/` (30 frames) |
| Planos e feature gating | `qrRvyH0k6l8/` (55 frames) |
| Cobrança recorrente | `G0XsZWjQV8c/` (17 frames) |
| Faturamento/relatórios | `db54n8_3_Sg/` (16 frames) |
| Gestão de admins parceiros | `XdikJZkmY7Q/` (30 frames) |
| Customização white-label | `bvpz84EThEU/` (33 frames) |
| Ações/menus personalizados | `jbgM0hgvTPc/` (29 frames) |
| Canal de demo | `-X2jMXU_zos/` (16 frames) |
| Dashboard parceiro | `S1liAttRAtw/` (16 frames) |
| Configuração FB | `-W1Gvw7_QzM/` (26 frames) |

**Quando virar SaaS (Fase 4), reler essas 11 pastas = spec completo.**

---

# Parte 7 — Ações imediatas (próximas 72h)

## T-0 (hoje, 2026-04-20)

1. ✅ Este documento criado e salvo em `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md`
2. 🔄 Marcelo revisa e dá OK/ajustes
3. 🔄 Commit + push para `main`
4. 🔄 Atualizar `MEMORY.md` com link para este plano

## T+1 (dia útil seguinte)

5. **Migração data real do Nexvy**:
   - Exportar 245 contatos + 171 deals do Nexvy (console.nexvy.tech → API → export CSV)
   - Script `pnpm nexvy:import` em `apps/erp-educacional/scripts/` que faz upsert respeitando dedup
6. **Criar 1º template WABA na Meta** (ex: "Olá {{1}}, tudo bem? Sou da FIC, vi seu interesse em {{2}}..."):
   - Submeter aprovação → aguarda 24-48h → desbloqueia Sprint S5
7. **Design tokens em produção**:
   - Atualizar `tailwind.config.ts` com todas as tokens da Parte 2.2
   - Criar `/app/(erp)/dev/tokens/page.tsx` para QA visual

## T+2 (sprint kickoff S4)

8. **Migration `20260421_atendimento_s4_kanban.sql`** aplicada em staging → testar → prod
9. **Seed das 2 pipelines FIC** + 11 stages + 6 campos custom iniciais (CPF / Nome da Mãe / Curso / Turma / Semestre / Origem)
10. **Componentes base do Kanban** (`KanbanBoard`, `DealCard`, `StageColumn`) em PR separado para review

## T+5 (meio sprint S4)

11. **Drag & drop com persistência** funcionando em staging
12. **Lead Detail Modal** — 2 colunas + 4 abas navegáveis (mesmo que abas vazias, só esqueleto)
13. **Protocolos** — modal no chat + número sequencial

## T+7 (deploy S4)

14. Deploy produção com feature flag `ATENDIMENTO_CRM_KANBAN_ENABLED=true`
15. Treinamento 30min com os 4 atendentes FIC + feedback
16. Registrar pendências em `docs/sessions/PENDENCIAS.md`
17. Kickoff S5

---

# Parte 8 — Apêndices

## A. Cross-reference vídeo ↔ sprint

| Sprint | Vídeos do benchmark obrigatórios (leitura antes de começar) |
|---|---|
| S4 | `y3CFR97J2Bo`, `N8n8LaxuZLc`, `hu38xgDc-l8`, `ssG53BDi1K0`, `VAa4tqrsFqI`, `g0_lGAnSzdY`, `Lus6OhCWhrg`, `TBl14qCjbcM`, `PvfppQNxQZs` |
| S5 | `Olr6prKExSo`, `1lrBXAnV31I`, `oOq8AVnwx7g`, `Bm9r57cOqMM`, `JHONOag6fEo`, `VCsSLNj7vzE` |
| S6 | `-LctSvm1Mzo`, `LsdXRmS7Agk`, `_KeeL_5wG5k`, `XWd-0Gj6R6E`, `HYKeZWyBCwY`, `wgsaW6I9KIM`, `XeemWygayPo`, `GTX_QLA1zeg` |
| S7 | `dNaKezWr_LY`, `0_0i72W2s68`, `t2bF8-5uui8`, `olMQTujz724`, `iTuVYvn347I`, `B8E5ab6SATs` |
| S8 | `SHTF1dwAtuc`, `X115LzVAliA`, `oGs_ByuGDWc`, `QlGUrIGjc44` |
| S9 | `CDOdwqe_-KE`, `yH5ysNLTAXE` |
| S10 | `RFn_fw6wYOw`, `Xf6tFnM4va4`, `6RFcmRoD4E0`, `AMDg3hbrui0`, `YpFcjGiMw2I`, `y3CFR97J2Bo` (re-ver focado em IA Copilot) |
| Fase 4 | Todos os 11 `[Parceiros]` |

## B. Tabela resumo de gap por categoria

| Categoria | Features mapeadas | Já temos | Falta | % coberto |
|---|---|---|---|---|
| Dashboard | 6 | 0 | 6 | 0% |
| Inbox/Conversas | 27 | 14 | 13 | 52% |
| CRM Kanban | 22 | 0 | 22 | 0% |
| Contatos | 12 | 2 | 10 | 17% |
| Agendamentos | 9 | 0 | 9 | 0% |
| Templates WABA | 7 | 1 (schema) | 6 | 14% |
| Automações | 9 | 2 | 7 | 22% |
| Webhooks/API | 8 | 1 | 7 | 13% |
| Links Redirecionamento | 5 | 0 | 5 | 0% |
| DS Voice | 11 | 0 | 11 | 0% |
| DS Agente | 11 | 0 | 11 | 0% |
| DS Bot | 12 | 0 | 12 | 0% |
| Chat Interno | 5 | 0 | 5 | 0% |
| Relatórios | 11 | 0 | 11 | 0% |
| Usuários/Cargos | 8 | 2 | 6 | 25% |
| Canais | 9 | 3 | 6 | 33% |
| Campanhas | 5 | 0 | 5 | 0% |
| Integrações | 3 | 0 | 3 | 0% |
| Configurações | 6 | 0 | 6 | 0% |
| Painel Parceiro | 12 | 0 | 12 | 0% (Fase 4) |
| **TOTAL** | **198** | **25** | **173** | **12,6%** |

**Leitura:** temos 12,6% da plataforma Nexvy replicada hoje. Após S4-S10 atingimos ~85%. Após Fase 4, 100%.

## C. Links canônicos

- **Benchmark completo**: `docs/research/nexvy-whitelabel/`
- **Plano UI detalhado**: `docs/research/nexvy-whitelabel/PLANO-LEVANTAMENTO-NEXVY.md` (branch `claude/competent-saha-13df32`)
- **INDEX 58 vídeos**: `docs/research/nexvy-whitelabel/INDEX.md`
- **Plano v2 histórico**: `apps/erp-educacional/memory/ATENDIMENTO-PLANO-v2-SESSAO088.md`
- **ADR Meta MBP**: `docs/adr/017-nexvy-meta-business-partner.md`
- **Migrations atendimento**: `infra/supabase/migrations/20260412_atendimento_modulo_init.sql` + `20260413_atendimento_s3_queues.sql`

## D. Métricas de sucesso do módulo (definidas agora, medidas após S7)

| Métrica | Meta mês 3 pós-S10 | Como medir |
|---|---|---|
| Mensagens atendidas/dia | 200+ | `messages WHERE DATE(created_at) = today` |
| Tempo médio primeira resposta | < 5min | delta entre conversation.created_at e primeira msg outgoing |
| Taxa de resolução sem intervenção humana (DS Agente) | > 40% | conversations resolvidas por ações automação |
| NPS atendimento | > 70 | pesquisa pós-resolução |
| Deals criados via atendimento → matrícula | > 30% | deals na etapa "Matrícula ativa" / total |
| Uso do Kanban pela equipe | 100% dos atendentes semanal | deals com `updated_at` nos últimos 7d por agente |
| Integração com ERP (aluno criado via atendimento) | > 20/mês | alunos WHERE source LIKE 'atendimento%' |

---

*Fim do plano. Este documento é a fonte única de verdade para o módulo Atendimento FIC. Toda decisão contrária a ele deve ser formalizada em novo ADR.*
*Última atualização: 2026-04-20 · Sessão S089 · Claude Sonnet 4.6*
