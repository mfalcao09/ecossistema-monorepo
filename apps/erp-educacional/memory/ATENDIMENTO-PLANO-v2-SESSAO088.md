# Plano de Implementação — Módulo Atendimento ERP v2
> **Criado:** Sessão 088 · 13/04/2026  
> **Base:** NEXVY-REFERENCIA-ATENDIMENTO.md (sessões 086-087) + Batches 3–10 (sessão 088)  
> **Escopo:** Incorpora todo o conhecimento adquirido nos 10 batches de análise do Nexvy CRM

---

## 1. O que já construímos — Sprint 1 ✅ COMPLETO

A sessão 085 entregou a fundação do módulo. O que está em produção hoje:

### 1.1 Tabelas Supabase (9 tabelas)
| Tabela | Descrição |
|--------|-----------|
| `inboxes` | Canais de atendimento (WhatsApp/Instagram) |
| `contacts` | Contatos (base) |
| `conversations` | Conversas/Tickets |
| `messages` | Mensagens do chat |
| `labels` | Tags coloridas |
| `conversation_labels` | M2M conversa↔tag |
| `agents` | Usuários/atendentes |
| `automation_rules` | Regras de automação |
| `whatsapp_templates` | Modelos de mensagem WABA |

### 1.2 Frontend (8 arquivos)
- TopBar de Atendimento
- Estrutura de rotas base

### 1.3 Dados reais da FIC (referência para seeds)
| Dado | Valor |
|------|-------|
| Contatos | 245 (WhatsApp) |
| Negócios | 171 no pipeline ATENDIMENTOS-GERAL |
| Canais | WABA ✅ · Instagram ✅ · WhatsApp Antigo ❌ |
| n8n | ID 2967 "N8N – AF EDUCACIONAL" ativo |
| Agentes | Fabiano Silva · Jhiully Lages · Cristina Passos · Marcelo Falcão |
| Tags | "Alunos" (62 contatos) · "1700" (1 contato) |
| Pipeline real | AGUARDANDO → SECRETARIA → FINANCEIRO → NOVAS MATRÍCULAS |

---

## 2. Inventário Nexvy Completo — Feature por Feature

### STATUS: ✅ Cobrimos no Sprint 1 | 🔄 Parcial | ❌ Falta | ⏭️ Fora do escopo

| Módulo Nexvy | Feature | Status ERP |
|--------------|---------|-----------|
| **Home/Dashboard** | Widgets de resumo (Canais, CRM, Conversas, Atividades) | ❌ Sprint 7 |
| | Widget Agentes de IA (status dos agentes autônomos) | ❌ Sprint 9+ |
| **Tickets/Inbox** | 3 painéis (lista + chat + informações) | ❌ Sprint 3 |
| | 5 abas padrão (Todas/Em atendimento/Aguardando/Minhas/Não atribuídas) | ❌ Sprint 3 |
| | Abas customizadas (saved views por agente) | ❌ Sprint 6 |
| | Sistema de protocolos (múltiplos por conversa) | ❌ Sprint 4 |
| | Chat com bubbles in/out + toolbar 5 tipos | ❌ Sprint 3 |
| | Banner "Janela Fechada" (WABA 24h) | ❌ Sprint 5 |
| | Breadcrumb pipeline no header do chat | ❌ Sprint 4 |
| | Iniciar conversa (Fila + Canal de Atendimento) | ❌ Sprint 3 |
| | Número de ticket sequencial (#1897217) | ❌ Sprint 3 |
| **CRM Negócios/Kanban** | Kanban com colunas 300px + drag & drop | ❌ Sprint 4 |
| | Multi-pipeline (ATENDIMENTOS-GERAL + Alunos + criar novo) | ❌ Sprint 4 |
| | Filtros kanban (Tags/Campanhas/Filas/Período) | ❌ Sprint 4 |
| | Menu de coluna ⋮ (Editar/Transferir/Baixar CSV/Execuções Automação) | ❌ Sprint 4 |
| | Toggle "Visualizar mensagens" nos cards | ❌ Sprint 4 |
| | Lead Detail Modal (2 colunas: perfil + 4 abas) | ❌ Sprint 4 |
| | Aba Negócios (barra de progresso de etapas + cadência) | ❌ Sprint 4 |
| | Aba Atividades (criar atividade com rich text + agendamento) | ❌ Sprint 4 |
| | Aba Histórico (log imutável de eventos) | ❌ Sprint 4 |
| | Aba Notas (textarea livre + anexo) | ❌ Sprint 4 |
| | 7 ações rápidas no card (Ver Conversa/Ligar/Agente/etc) | ❌ Sprint 4 |
| **Central de Atividades** | Filtros: Categoria/Status/Tipo, contadores Próximas/Hoje/Atrasadas | ❌ Sprint 4 |
| **Ligações** | Discador VoIP integrado, histórico com gravação | ⏭️ Fase 2 |
| **CRM Contatos** | Tabela com busca + filtro por tags | 🔄 Sprint 1 base |
| | Import/Export CSV com detecção de duplicatas + merge | ❌ Sprint 6 |
| | Campos customizados da empresa (Nome do Campo + Tipo + obrigatório) | ❌ Sprint 6 |
| | Campos customizados do contato (inline no lead detail) | ❌ Sprint 4 |
| | Ações em massa (bulk select + bulk delete) | ❌ Sprint 6 |
| | Produtos Comerciais (Nome + Valor, vinculável a negócios) | ❌ Sprint 4 |
| **Agendamentos** | Calendário Mês/Dia/Lista com filtros | ❌ Sprint 5+ |
| | Enviar mensagem agendada via WhatsApp (variáveis + canal) | ❌ Sprint 5 |
| | Evento Google Calendar + Google Meet | ❌ Sprint 5+ |
| **Modelos de Mensagem (WABA)** | Grid com preview estilo WhatsApp | ❌ Sprint 5 |
| | 3 categorias (Utilitário/Marketing/Autenticação) | ❌ Sprint 5 |
| | Variáveis {{1}}, botões Quick Reply + CTA | ❌ Sprint 5 |
| | Status de aprovação (Pendente/Aprovado/Rejeitado/etc) | ❌ Sprint 5 |
| | Sincronizar com Meta API | ❌ Sprint 5 |
| **Links de Redirecionamento** | 4 tipos distribuição (Sequencial/Aleatória/Ordenada/Por Horário) | ❌ Sprint 8 |
| | Slug único, rastreável, multi-canal | ❌ Sprint 8 |
| **Chat Interno** | 2 painéis, grupos, mensagens em tempo real | ❌ Sprint 8 |
| **DS Voice — Mensagens** | Biblioteca de textos com variáveis + pastas + toggles | ❌ Sprint 9 |
| **DS Voice — Áudios** | Biblioteca de áudios ≤16MB + toggle "enviar como gravação" | ❌ Sprint 9 |
| **DS Voice — Mídias** | Biblioteca imagens ≤5MB / vídeos ≤100MB + caption | ❌ Sprint 9 |
| **DS Voice — Documentos** | Biblioteca documentos ≤100MB (com aviso incompatibilidade Instagram) | ❌ Sprint 9 |
| **DS Voice — Funis** | Sequências com delay (drip sequences) | ❌ Sprint 9 |
| **DS Voice — Gatilhos** | Automações por palavra-chave → dispara funil | ❌ Sprint 9 |
| **DS Agente** | Agente IA com OpenAI + RAG + regras de ativação por tag | ❌ Sprint 10+ |
| **DS Bot** | Visual flow builder (Bubbles + Inputs + nós) | ❌ Sprint 10+ |
| **Automações/Filas** | Fila com distribuição automática (5 tipos) | ❌ Sprint 3 |
| | Mensagem de saudação com variáveis {{primeiroNome}} etc. | ❌ Sprint 3 |
| | Integração n8n por fila (n8n ID 2967 já ativo!) | ❌ Sprint 8 |
| | Integração DS Agente por fila | ❌ Sprint 10+ |
| **Webhooks** | Entrada (endpoint + tags automáticas) | ❌ Sprint 8 |
| | Saída (URL + tentativas + eventos Comercial+Canal) | ❌ Sprint 8 |
| **Cargos e Permissões** | 6 tipos de cargo, permissões granulares por 13 módulos | ❌ Sprint 6 |
| **Widgets** | URLs externas incorporadas com {{user.email}} / {{user.id}} | ❌ Sprint 7 |
| **Configurações** | Moeda, Tipo Agendamento, Horário Comercial, Saudação automática | ❌ Sprint 6 |
| **API REST** | Endpoints Mensagens, Dashboard (10), CRM (3 recursos), Webhooks (3) | ❌ Sprint 8 |
| **DS Track** | Rastreamento Meta ADS + GTM | ⏭️ Fora do escopo |
| **Multi-tenant (Parceiro)** | Painel parceiro, planos, produtos, checkout | ⏭️ Fase 2+ |

---

## 3. Gap Analysis Atualizada (Novas tabelas dos Batches 3–9)

### Tabelas novas descobertas nos batches 3–9 (não estavam no original):

| Tabela | Descoberta no Batch | Prioridade | Sprint |
|--------|---------------------|-----------|--------|
| `queues` | Batch 7 (Filas com distribuição automática) | P1 | S3 |
| `queue_members` | Batch 7 (usuários por fila) | P1 | S3 |
| `deals` | Batch 2-3 | P1 | S4 |
| `pipelines` | Batch 2 | P1 | S4 |
| `pipeline_stages` | Batch 2 | P1 | S4 |
| `protocols` | Batch 2 | P1 | S4 |
| `deal_activities` | Batch 2-3 | P2 | S4 |
| `deal_history_events` | Batch 2 | P2 | S4 |
| `deal_notes` | Batch 2 | P2 | S4 |
| `contact_custom_fields` | Batch 2-3 | P2 | S4 |
| `contact_company_custom_fields` | Batch 3 (campos da empresa toda) | P2 | S6 |
| `stage_task_cadences` | Batch 2 | P2 | S4 |
| `campaigns` | Batch 2 | P2 | S4 |
| `automation_executions` | Batch 2 | P3 | S8 |
| `saved_views` | Batch 2 | P2 | S6 |
| `conversation_transfers` | Batch 9 (webhooks de saída cobrem isso) | P2 | S4 |
| `agent_statuses` | Batch 9 (todos pausados → status existe) | P2 | S3 |
| `products` (comerciais) | Batch 4 | P3 | S4 |
| `scheduled_messages` | Batch 5 (agendamentos de mensagem) | P2 | S5 |
| `calendar_events` | Batch 5 (Evento Google Calendar) | P3 | S5 |
| `link_redirects` | Batch 6 (Links de Redirecionamento) | P3 | S8 |
| `agent_roles` | Batch 9 (Cargos com permissões) | P2 | S6 |
| `role_permissions` | Batch 9 (permissões por módulo) | P2 | S6 |
| `widgets` | Batch 9 (URLs externas incorporadas) | P3 | S7 |
| `account_settings` | Batch 9 (Configurações gerais) | P2 | S6 |
| `ds_voice_folders` | Batch 7 / original | P3 | S9 |
| `ds_voice_messages` | Batch 7 / original | P3 | S9 |
| `ds_voice_audios` | Batch 7 / original | P3 | S9 |
| `ds_voice_media` | Batch 7 / original | P3 | S9 |
| `ds_voice_documents` | Batch 7 / original | P3 | S9 |
| `ds_voice_funnels` | Batch 7 / original | P3 | S9 |
| `ds_voice_funnel_steps` | Batch 7 / original | P3 | S9 |
| `ds_voice_triggers` | Batch 7 / original | P3 | S9 |
| `team_chats` | Batch 5 / original | P3 | S8 |
| `team_messages` | Batch 5 / original | P3 | S8 |

### Campos novos nas tabelas existentes (descobertas batches 3–9):

| Tabela | Campos novos a adicionar |
|--------|--------------------------|
| `conversations` | `queue_id FK`, `deal_id FK`, `ticket_number BIGSERIAL`, `window_expires_at`, `last_read_at`, `waiting_since`, `protocol_count` |
| `messages` | `status ENUM(sent/delivered/read)`, `media_type`, `media_url`, `waba_template_id`, `connection_token` |
| `agents` | `status ENUM(online/offline/paused)`, `pause_reason`, `avatar_url`, `role_id FK`, `voip_number` |
| `contacts` | `phone_number`, `avatar_url`, `color_hex`, `has_duplicates BOOL`, `source` |
| `inboxes` | `connection_token` (token do canal para API), `waba_account_id`, `channel_type ENUM` |
| `whatsapp_templates` | `waba_account_id`, `template_category ENUM`, `language_code`, `status ENUM`, `has_buttons BOOL`, `button_type ENUM` |
| `queues` | `color_hex`, `distribution_type ENUM(aleatorio/sequencial/ordenado/nao_distribuir/fila_espera)`, `n8n_integration_id`, `ds_agent_id FK`, `greeting_message TEXT`, `visible_to_all BOOL` |

---

## 4. Roadmap de Sprints v2 (Atualizado com Batches 3–10)

### Sprint S1 ✅ COMPLETO (Sessão 085)
Fundação: 9 tabelas + 8 arquivos frontend + TopBar.

---

### Sprint S2 — Webhook WhatsApp + Recepção de Mensagens 🔥 PRÓXIMO
**Objetivo:** Receber mensagens reais do WhatsApp WABA da FIC e salvar no banco.
**Pré-requisito:** Meta Cloud API token + Phone Number ID + WABA Account ID (Marcelo trouxer)

| Item | Estimativa |
|------|-----------|
| Webhook POST `/api/atendimento/webhook` com HMAC-SHA256 | 4h |
| Bull Queue Railway — fila de processamento | 3h |
| Message processor (salvar em `messages` + criar/atualizar `conversations`) | 4h |
| Contact upsert (criar ou vincular contato pelo número) | 2h |
| Status delivery (sent/delivered/read) | 2h |
| Campo `window_expires_at` em conversations | 1h |
| Campo `ticket_number BIGSERIAL` em conversations | 1h |
| Campo `connection_token` em inboxes + messages | 1h |
| **Total estimado** | **~18h** |

> ⚠️ **BLOQUEADO ATUALMENTE** — aguarda credenciais Meta Cloud API da FIC

---

### Sprint S3 — Inbox 3 Painéis + Filas (UI Core) 🎨
**Objetivo:** Interface de atendimento navegável + sistema de filas funcional.

| Item | Descrição |
|------|-----------|
| Migrations | `queues`, `queue_members`, `agent_statuses`, `queue_id` em conversations |
| Seed Filas FIC | "Secretaria", "Financeiro", "Matrículas" (refletindo o kanban real) |
| Mensagem de saudação | Com variáveis `{{primeiroNome}}`, `{{nomeCompleto}}`, `{{saudacao}}`, `{{hora}}` |
| Distribuição automática | Aleatória \| Sequencial \| Ordenada \| Não distribuir \| Fila de Espera |
| Painel esquerdo 320px | Lista de conversas: busca + filtro canal/status + badge não lido |
| 5 abas padrão | Todas · Em atendimento · Aguardando · Minhas · Não atribuídas |
| Painel central | Chat com bubbles in/out, toolbar 5 tipos, textarea expansível |
| Header chat | Breadcrumb pipeline + gerenciar agente + ações (Agendamento/Transferir/Deletar) |
| Banner janela fechada | Aviso + disable input + CTA para selecionar template |
| Modal "Iniciar Conversa" | Buscar contato + Selecionar fila + Selecionar canal |
| Painel direito | Tabs: Informações / Histórico / Negócios |
| Status dos agentes | Online / Offline / Pausado (dot colorido: verde/cinza/laranja) |

---

### Sprint S4 — CRM Kanban + Lead Detail Modal 🗂️
**Objetivo:** Kanban de negócios completo com todos os dados do FIC.

| Item | Descrição |
|------|-----------|
| Migrations P1 | `pipelines`, `pipeline_stages`, `deals`, `campaigns`, `protocols` |
| Migrations P2 | `deal_activities`, `deal_history_events`, `deal_notes`, `contact_custom_fields`, `stage_task_cadences`, `automation_executions`, `products` |
| Seed FIC | 2 pipelines (ATENDIMENTOS-GERAL + Alunos), 4 etapas, 171 deals mock |
| Kanban board | Colunas 300px, drag & drop, horizontal scroll, `height: calc(100vh - 90px)` |
| Multi-pipeline | Drawer lateral 480px com seletor de pipeline + "+ Criar nova pipeline" |
| Toggle visualizar mensagens | Compact vs message_preview |
| Filtros kanban | Tags · Campanhas · Filas · Período · checkboxes (não lidas, tarefas pendentes) |
| Menu ⋮ por coluna | Editar · Transferir negócios · Baixar CSV · Execuções de Automação |
| Lead Detail Modal | 2 colunas: esquerda (perfil + 7 ações) + direita (4 abas) |
| Aba Negócios | Barra de progresso de etapas + cadência de tarefas + selector de deal |
| Aba Atividades | Criar atividade (tipo + responsável + data + duração + nota rich text + anexo) |
| Central de Atividades | Página dedicada com 4 contadores + filtros Categoria/Status/Tipo |
| Aba Histórico | Log imutável: stage_transfer, ticket_transferred, note_added, etc. |
| Aba Notas | Textarea livre + anexo por negócio |
| Produtos Comerciais | CRUD simples (Nome + Valor), vinculável ao criar negócio |
| Protocolos | Modal por ticket, número sequencial auto, status + responsável |
| Breadcrumb bidirecional | `deal_id` em conversations ↔ stage no header do chat |

---

### Sprint S5 — Templates WABA + Envio Ativo + Agendamentos 📤
**Objetivo:** Usar templates WABA da FIC + agendamento de mensagens.

| Item | Descrição |
|------|-----------|
| Sync templates | GET Meta API → salvar em `whatsapp_templates` |
| Grid de templates | Cards com preview estilo WhatsApp, status (Aprovado/Pendente/etc.) |
| Categorias | Utilitário / Marketing / Autenticação |
| Criar template | 3 categorias, variáveis `{{1}}`, botões Quick Reply OU CTA (mutuamente exclusivos) |
| Status de aprovação | Rascunho → Pendente → Aprovado / Rejeitado |
| Envio ativo | POST mensagem via Meta API com template |
| Fluxo janela fechada | Modal template integrado ao chat quando 24h expirado |
| Agendamentos (básico) | Migrations: `scheduled_messages` + UI calendário 3 modos |
| Mensagem agendada | Tipo: Texto / Imagem / Áudio / DS Voice + variáveis + canal WABA |
| Job de disparo | Worker Railway que dispara mensagens agendadas no horário |

---

### Sprint S6 — Gestão de Contatos + Cargos + Configurações 👥
**Objetivo:** CRM de contatos completo + sistema de permissões.

| Item | Descrição |
|------|-----------|
| Color picker para tags | Tags com cor hex para contatos |
| Import CSV | Drag-and-drop, validação, upsert por número normalizado |
| Export CSV | Download filtrado por tag/período |
| Detecção de duplicatas | Por número de telefone normalizado (E.164) |
| Merge modal | Selecionar dados canônicos entre duplicatas |
| Saved Views | `saved_views` + modal "Nova Aba Customizada" (Pipeline + Coluna + Tags + Responsáveis) |
| Campos customizados empresa | `contact_company_custom_fields` — campos globais da conta (Nome + Tipo + obrigatório) |
| Cargos | `agent_roles` + 6 tipos (Padrão/SDR/BDR/Closer/Suporte/Atendente) |
| Permissões granulares | `role_permissions` — por módulo (13 módulos) |
| Configurações | `account_settings`: Moeda, Tipo Agendamento, Horário Comercial |
| Config de Atendimento | Saudação ao aceitar/transferir, sincronizar responsável conversa↔negócio |
| Segurança | Restringir visualização de histórico |

---

### Sprint S7 — Dashboard / Relatórios / Widgets 📊
**Objetivo:** Métricas operacionais e widgets configuráveis.

| Item | Descrição |
|------|-----------|
| 6 tipos de relatório | Vendas · Atividades · Conversas · Ligações · SDR · Closer |
| Filtros | Data range · Usuário/agente · Tipo |
| Gráficos customizáveis | Modal "Adicionar Gráfico" + nome + cargo + toggle percentuais |
| ApexCharts | Barras e linhas |
| Job diário | Agregar métricas em `metrics_snapshots` |
| Home widgets | Cards de resumo (Canais, CRM, Conversas, Atividades, Agentes IA) |
| Widgets configuráveis | URLs externas com `{{user.email}}` / `{{user.id}}`, modo Nova Aba ou Incorporado |

---

### Sprint S8 — Chat Interno + Automações + Webhooks + N8N + Links 💬
**Objetivo:** Comunicação interna + automações configuráveis + integração n8n + API.

| Item | Descrição |
|------|-----------|
| Chat interno | `team_chats` + `team_messages` — 2 painéis, grupos, Supabase Realtime |
| Automações UI | CRUD visual de regras (gatilho + condição + ação) |
| Automações de Coluna | Regras específicas por coluna do kanban |
| Auto-assign | Regra: conversa entra → atribuir agente com menos carga |
| Mensagem de boas-vindas | Auto-reply em conversa nova |
| **Webhooks de entrada** | Endpoint + atribuição de tags automáticas ao lead |
| **Webhooks de saída** | URL + tentativas + eventos Comercial e Canal de atendimento |
| **API REST pública** | Endpoints: Mensagens, Dashboard (10), CRM (Contatos/Tickets/Negócios) |
| Connection-Token | Token por canal para autenticar envio via API |
| **Integração n8n** | Trigger n8n quando evento ocorre (FIC já usa n8n ID 2967!) |
| Links de Redirecionamento | `link_redirects` com 4 tipos distribuição (Seq/Aleat/Ord/Por Horário) + slug único |

---

### Sprint S9 — DS Voice: Biblioteca de Conteúdo + Funis + Gatilhos 📚
**Objetivo:** Replicar módulo DS Voice — biblioteca de conteúdo + automações de disparo.

| Item | Descrição |
|------|-----------|
| Migrations | Todas as tabelas `ds_voice_*` (8 tabelas) + `ds_voice_folders` |
| Biblioteca Mensagens | CRUD + pastas + variáveis `{Nome}` `{Primeiro Nome}` `{Saudação}` + toggles |
| Biblioteca Áudios | Upload .mp3/.ogg ≤16MB + toggle "enviar como gravação" |
| Biblioteca Mídias | Upload imagem ≤5MB / vídeo ≤100MB + caption |
| Biblioteca Documentos | Upload ≤100MB + aviso incompatibilidade Instagram |
| Construtor de Funis | Steps ordenados com delay, contador duração total |
| Gatilhos | Form completo (condição + funil + toggles WhatsApp/Instagram) |
| Export/Import .json | Backup e restauração da biblioteca |
| Uso no chat | Ícone DS Voice na toolbar do chat → selecionar da biblioteca |
| Uso no agendamento | Tipo DS Voice no modal de Agendamento |

---

### Sprint S10+ — DS Agente + DS Bot (IA Autônoma) 🤖
**Objetivo:** Agentes de IA autônomos para atendimento automatizado.

| Item | Descrição |
|------|-----------|
| DS Agente | Integração OpenAI: system prompt + RAG (base de conhecimento) |
| Parâmetros do agente | Temperatura, Máx Tokens (100), Máx Histórico (10), Delay |
| Regras de ativação | Lógica condicional por tag (E/OU) |
| Toggles | Dividir resposta em blocos, processar imagens, desabilitar quando responder fora |
| Base de conhecimento | Upload de documentos para RAG da FIC (FAQ matrícula, etc.) |
| DS Bot | Visual flow builder canvas |
| Componentes Bubbles | Texto / Imagem / Vídeo / Incorporar / Áudio |
| Componentes Inputs | Texto / Número / Email / Website / Data / Telefone / Botão / Arquivo |
| 3 formas de criar | Do zero / A partir de modelo / Importar arquivo |
| Vincular bot às filas | DS Bot / DS Agente na configuração da fila |
| Widget Home | Badge "N agentes em atividade · N erros recentes" |

---

## 5. Decisões de Arquitetura (Atualizadas)

### O que aprendemos de novo nos batches 3–10

**1. Filas são a peça central do roteamento**  
No Nexvy, a fila (`queue`) é onde converge tudo: distribuição automática, mensagem de saudação, integração n8n, DS Agente, DS Bot. A nossa tabela `queues` precisa de todos esses campos desde o Sprint 3.

**2. n8n ID 2967 já está ativo — priorizar a integração**  
A FIC tem "N8N – AF EDUCACIONAL" funcionando no Nexvy. Isso significa que no Sprint 8, quando expormos webhooks/API, o n8n da FIC pode começar a automatizar o ERP imediatamente. Não é teoria — é realidade operacional.

**3. Connection-Token = identidade do canal**  
Ao enviar via API, o header `Connection-Token` identifica QUAL canal envia (WABA vs Instagram vs WhatsApp Antigo). Isso é separado da `api-key` (identidade da empresa). Nossa `inboxes` precisa desse campo.

**4. Agendamentos são bidirecionais**  
O Nexvy tem 2 tipos: (a) mensagem agendada via WhatsApp — envia no horário especificado; (b) evento Google Calendar — cria evento na agenda. Para o Sprint 5, começamos com (a) pois não exige integração com Google.

**5. Links de Redirecionamento = distribuição de leads**  
O tipo "Por Horário" permite que um link distribua leads para atendentes conforme o horário de trabalho. Útil para a FIC que tem turnos. A tabela `link_redirects` precisa de `schedule_config JSONB`.

**6. Campos customizados têm dois níveis**  
- **Empresa (global):** campos definidos para toda a conta (batch 3 — "Campos personalizados da empresa") → `contact_company_custom_fields`
- **Contato (por instância):** valor de cada campo por contato → `contact_custom_fields`

**7. Cargos cobrem 13 módulos de permissão**  
Os cargos no Nexvy têm permissões muito granulares (Início, Relatórios, Conversas, DS Voice, CRM, DS Track, Recursos, Automações, Canais de Atendimento). Para o ERP, adaptar para os módulos equivalentes: Dashboard, Conversas, CRM, Automações, Configurações, Diploma (módulo exclusivo do ERP).

**8. Widgets são pontes para sistemas externos**  
O Nexvy permite incorporar URLs externas (com user.email e user.id no parâmetro) como tabs dentro da interface. Para o ERP, isso é a ponte para integrar o módulo Diploma dentro do módulo Atendimento — o agente pode abrir o processo de diploma do aluno sem sair do atendimento.

### O que NÃO fazemos (fora do escopo)
- DS Track / Meta ADS + GTM (produto separado)
- DS Voice VoIP / chamadas Twilio (Fase 2+)
- Multi-tenant (Painel Parceiro) — Fase 2
- Comprar número VoIP (aguarda decisão da FIC)

### Estratégia single-tenant → multi-tenant
Todas as tabelas têm `account_id UUID NULL`.
Sprint 1–10: `account_id = null` (single-tenant FIC).
Quando virar SaaS: adicionar `account_id NOT NULL` + RLS por account.

---

## 6. Configuração Nexvy da FIC (Estado Atual — Referência para Seeds)

| Configuração | Estado |
|-------------|--------|
| Assinatura | Plano Unlimited, ativa até 06/03/2027 |
| Canal principal | WABA +55(67)9 3618-0058 ✅ |
| Canal Instagram | FIC ✅ (mas número inválido em Links — corrigir) |
| Canal legado | Whats Antigo +55(67)9 8447-1955 ❌ desconectado |
| Integração n8n | ID 2967, "N8N – AF EDUCACIONAL", ativo |
| API Key | NÃO gerada ainda (gerar em console.nexvy.tech → API) |
| Usuários | 4 (Fabiano/Jhiully/Cristina/Marcelo), todos pausados |
| Cargos | Nenhum criado ainda |
| Filas | Nenhuma criada ainda |
| Configurações | Todas desabilitadas |
| Google Calendar | Não conectado |
| Meta ADS | Não conectado |
| Templates WABA | Nenhum criado (precisa criar e aguardar aprovação Meta 24-48h) |
| VoIP | Não configurado |

---

## 7. Próximas Ações Imediatas

### Para desbloquear Sprint S2 (Webhook WhatsApp):
1. **Marcelo obtém no Business Manager da FIC:**
   - Meta Cloud API Token
   - Phone Number ID (+55 67 9 3618-0058 WABA)
   - WABA Account ID

2. **Gerar api-key no Nexvy** (console.nexvy.tech → API → ícone 🔑)

3. **Criar primeiro template WABA** (ex: mensagem de boas-vindas de matrícula)
   - Aguardar aprovação Meta (24-48h)
   - Isso desbloqueia Sprint S5

### Para fazer agora (sem bloqueadores):
- Criar filas no Nexvy: Secretaria · Financeiro · Matrículas
- Configurar mensagem de saudação das filas
- Criar Cargo "Atendente" com permissões básicas
- Vincular integração n8n na fila principal

---

*Documento criado em sessão 088 (13/04/2026) após análise completa de 10 batches de prints do Nexvy CRM.*  
*Supersede: use este documento como plano principal. NEXVY-REFERENCIA-ATENDIMENTO.md permanece como referência de design/UX.*
