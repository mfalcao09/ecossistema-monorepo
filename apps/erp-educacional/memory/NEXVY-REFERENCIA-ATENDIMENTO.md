# Nexvy → ERP Atendimento — Análise de Referência Visual

> **Criado:** Sessão 086 · 12/04/2026  
> **Atualizado:** Sessão 087 · 12/04/2026 (22 prints batch 1 + 38 prints batch 2 incorporados)  
> **Finalidade:** Usar Nexvy (console.nexvy.tech) como referência visual/funcional para o módulo Atendimento do ERP — mesma abordagem do Aluno Digital no módulo Diploma.  
> **Nota:** NÃO copiamos. NÃO integramos. Construímos do zero, inspirados no que funciona.

---

## 1. Contexto: FIC já é cliente Nexvy

A FIC (`AF EDUCACIONAL`) usa o Nexvy ativamente:
- **245 contatos** cadastrados (WhatsApp)
- **171 negócios** no pipeline "ATENDIMENTOS - GERAL"
- **3 canais configurados:**
  - "Faculdades Integradas de Cassilândia - FIC" (Instagram — **desconectado**)
  - "Faculdades Integradas de Cassilândia - WABA" (WhatsApp WABA — **ativo**)
  - "Whats Antigo - FIC" (WhatsApp API antigo)
- **5 agentes/membros da equipe:** Suporte · Marcelo Falcão · Cristina Passos · Jhiully Lages · Fabiano Silva
- **Pipeline real (4 etapas):** AGUARDANDO → SECRETARIA → FINANCEIRO → NOVAS MATRÍCULAS
- **N8N conectado:** "N8N - AF EDUCACIONAL" aparece em Gerenciar Integração dentro das conversas

Isso nos dá uma fonte verdade sobre o workflow real da instituição — o kanban já reflete o processo da secretaria acadêmica.

---

## 2. Mapa Completo de Módulos Nexvy

### 2.1 Home / Dashboard (`/home`) 📊
**O que é:** Página inicial com widgets de resumo.
- **Widget Canais:** mostra 2 canais configurados + indicação de desconectado (ícone vermelho)
- **Widget CRM:** 0 pipelines ativos, 0 negócios — counter em destaque
- **Widget Conversas:** métricas do dia (total, tempo médio, NPS)
- **Widget Atividades:** tabela de atividades recentes
- **Widget Eventos do Dia:** agenda do dia
- **Widget Automações de Colunas CRM:** badge azul com count de automações por coluna do kanban — **relevante para Sprint 8**
- **Widget Agentes de IA:** `0 agente em atividade · 0 erros recentes` — Nexvy tem feature de agentes autônomos; badge de status dos agentes IA

**Insight para ERP:** Nossa home deve ter estrutura similar de widgets. O "Agentes de IA" é a feature mais avançada — podemos replicar no nosso módulo de automações.

---

### 2.2 Conversas / Tickets (`/tickets`) ⭐ CORE
**O que é:** Inbox de atendimento tipo 3 painéis.

#### Painel Esquerdo (320px) — Lista de Tickets
- Busca + filtros (canal, status, protocolo)
- **5 abas padrão:** Todas · Em atendimento · Aguardando · Minhas · Não atribuídas
- **Abas customizadas** (ver item 2.2.1 abaixo)
- Badge de não lido por conversa
- Preview do último texto + timestamp relativo
- **Filtro por canal:** dropdown com os 3 canais da FIC (ícones coloridos Instagram/WhatsApp)
- **Filtro por status:** Todas / Em andamento / Aguardando atendimento / Fechadas
- **Ordenação:** Mais recentes / Mais antigas / Última mensagem

#### Painel Central — Chat Ativo
- **Header:**
  - Avatar do contato + nome
  - **Breadcrumb de pipeline:** `ATENDIMENTOS - GERAL › AGUARDANDO` — mostra o estágio do kanban diretamente no chat
  - Ações: ⋮ dropdown (Agendamento · Transferir · Uso de Tokens · Deletar)
  - Botão "Gerenciar Agente" (popover com seleção de responsável)
  - Botão "Gerenciar Integração" (popover com integrações — exibe "N8N - AF EDUCACIONAL")
  - Botão "Protocolo" com tooltip "Filtro por Protocolo"
  - Botão Finalizar
- **Bubbles:**
  - In: alinhado à esquerda, fundo cinza claro
  - Out: alinhado à direita, fundo verde WhatsApp (`#dcf8c6`)
  - Max-width 70%, border-radius 8px/18px
- **Barra de Input:**
  - **5 ícones no toolbar:** funnel/templates · texto (T) · áudio (microfone) · imagem (foto) · documento (arquivo)
  - Textarea expansível
  - Botão Enviar
- **Banner "Janela Fechada":** quando a janela de 24h está expirada, aparece aviso `Janela de conversação fechada` com CTA para enviar template primeiro
- **Ticket number** visível (ex: #1897217)

#### Painel Direito — Informações do Contato
- **3 abas:** Informações / Histórico / Negócios
- **Aba Informações:** nome, número, email, tags
- **Chip de tag:** badge colorido + `+ Adicionar tag`
- **Aba Histórico:** timeline de eventos
- **Aba Negócios:** deals vinculados à conversa

#### 2.2.1 Abas Customizadas (Saved Views) ⭐ FEATURE IMPORTANTE
**O que é:** Agentes criam suas próprias abas de visualização filtrada.
- **Modal "Nova Aba Customizada":**
  - Campo: Nome da aba
  - Filtro: Pipeline (dropdown)
  - Filtro: Coluna do CRM (dropdown, depende do pipeline)
  - Filtro: Tags (multi-select)
  - Filtro: Responsáveis (multi-select com avatares)
  - Filtro: Status (Em andamento / Aguardando / Fechadas)
- **Impacto no schema:** precisamos de tabela `saved_views` com JSON de filtros

#### 2.2.2 Sistema de Protocolos ⭐ GAP CRÍTICO
**O que é:** Cada ticket pode ter múltiplos protocolos numerados.
- **Modal "Protocolos do Ticket #1897217":**
  - Protocolo: `#2010351`
  - Status: `Em andamento`
  - Responsável: selecionável
  - Histórico de protocolos anteriores
- **Conclusão:** precisamos de tabela `protocols` separada de `conversations`
- Um ticket = Uma conversa. Uma conversa pode ter N protocolos.

#### 2.2.3 Modal "Iniciar Conversa" ⭐ CONFIRMA QUEUES
- Campo: `Buscar contato` (nome ou número)
- Campo: `Selecione uma fila` (dropdown — confirma filas ≠ inboxes)
- Campo: `Selecione um Canal de Atendimento` (dropdown — os canais configurados)
- **Confirma definitivamente:** `queues` e `inboxes` são entidades distintas no schema

---

### 2.3 CRM Negócios / Kanban (`/business`) ⭐ CORE
**O que é:** Kanban de pipeline de atendimento.
- Colunas: **AGUARDANDO (171)** · SECRETARIA · FINANCEIRO · NOVAS MATRÍCULAS
- Cards: avatar + nome + valor + timestamp "Criado há X"
- Ações por card: Ver Conversa · Ligar · Marcar não lido · Anotações · Selecionar agente
- Horizontal scroll, colunas 300px, `cursor: grab`
- Status dot verde (ativo) · vermelho (inativo)
- Múltiplos pipelines via drawer lateral (480px)
- **Breadcrumb no chat** mostra o estágio ativo (ex: `ATENDIMENTOS - GERAL › AGUARDANDO`) — integração bidirecional entre inbox e kanban

#### 2.3.1 Seletor de Pipeline — Múltiplos Pipelines 🆕
A FIC tem **2 pipelines distintos** confirmados nos prints:
1. **"ATENDIMENTOS - GERAL"** — pipeline principal (171 negócios)
2. **"Alunos"** — pipeline secundário
3. **"+ Criar nova pipeline"** — CTA para criação inline

→ A tabela `pipelines` deve ser multi-row desde o Sprint 1. Seed já com os 2 pipelines da FIC.

#### 2.3.2 Filtro do Kanban — Painel de Filtros 🆕
Botão "Filtros" abre popover com os campos:
| Campo | Tipo | Observação |
|-------|------|-----------|
| Tags | Multi-select chips | Tags do contato |
| Campanhas | Multi-select | Entidade separada — tabela `campaigns` |
| Filas | Dropdown | `queues` novamente confirmado |
| Período | Date range | Filtro por data de criação |
| "Somente mensagens não lidas" | Checkbox | |
| "Somente com tarefas pendentes" | Checkbox | |

→ Tabela `campaigns` identificada como nova entidade necessária.

#### 2.3.3 Menu de Coluna (⋮ por coluna) 🆕
Cada coluna do kanban tem menu **⋮** com 4 opções:
1. **Editar coluna** — abre modal com nome + cor
2. **Transferir negócios** — move todos os cards para outra coluna
3. **Baixar CSV** — exporta todos os deals da coluna
4. **Execuções de Automação** — histórico de automações disparadas nesta coluna

→ Implicação: automações têm log por coluna (`automation_executions` com `pipeline_stage_id`).

#### 2.3.4 Modal "Adicionar Coluna" 🆕
- Campo: **Nome** (text input)
- Campo: **Cor** (color picker — paleta de chips coloridos, sem hex livre, ~12 cores predefinidas)

#### 2.3.5 Modal "Criar Negócio" 🆕
| Campo | Tipo | Obrigatório |
|-------|------|------------|
| Lead | Selector (busca contato) | Sim |
| Responsável | Dropdown agentes (pré-preenche "Marcelo Falcão") | Sim |
| Valor | Number (R$) | Sim |
| Produto | Selector opcional | Não |

→ Confirma `deals` precisa de `product_id FK` opcional. Tabela `products` necessária (P3).

#### 2.3.6 Toggle "Visualizar mensagens" 🆕
- Botão no topo da kanban com tooltip:
  - "Visualização desativada" → cards mostram só avatar + nome + valor
  - "Visualização ativada" → cards mostram preview da última mensagem do contato
- Implementação: estado `view_mode: 'compact' | 'message_preview'` no componente, sem persistência no banco.

**Gap no schema Sprint 1:** Falta `deals` (negócios), `pipeline_stages`, `pipelines`, `campaigns`.

---

### 2.3.7 Lead Detail Modal ⭐ DESCOBERTA COMPLETA BATCH 2

**O que é:** Modal de detalhes de um lead/negócio, abre ao clicar no card do kanban.  
**Referência:** card "Laura 💙 Fisioterapeuta" (leadDetailContactId=8058172)

#### Layout do Modal
- **Painel esquerdo (~33%):** perfil + ações rápidas + metadados
- **Painel direito (~67%):** 4 abas de conteúdo

#### Painel Esquerdo — Informações do Contato
- Avatar + nome do contato
- **7 ícones de ação (com tooltips):**

| Ícone | Tooltip / Função |
|-------|-----------------|
| 💬 | Ver Conversa — abre o chat da conversa vinculada |
| 🔴 | Marcar como não lido |
| 📞 | Ligar para o contato (DS Voice VoIP) |
| 👤 | Selecionar agente responsável |
| ✏️ | Editar contato (abre modal de edição) |
| 🔄 | Trocar responsável |
| ↗️ | Transferir de Pipeline |

- **Tags section:** chips coloridas existentes + `+ Adicionar tag` (dashed chip)
- **Pipeline section:** Funil / Etapa / Valor / Status (`Aberto` badge verde)
- **Informações section (campos inline):**
  - Telefone (campo padrão)
  - `+ Adicionar campo` → abre pair **"Nome do campo / Valor"** com botões ✓/✗
  - Campos adicionais exibidos como `Label: Valor` com lápis de edição inline
  - → Tabela `contact_custom_fields` necessária (P2)

---

#### Aba 1 — Negócios (Deals)
- **Deal selector dropdown:** ex: "ATENDIMENTOS - GERAL - AGUARDANDO" — lista todos os deals do contato
- **Barra de progresso por etapas:**
  - Exibe todas as colunas do pipeline como steps horizontais
  - Etapa atual fica highlighted em azul (`#345EF3`)
  - Exemplo FIC: `[AGUARDANDO]●━━━━[SECRETARIA]━━━━[FINANCEIRO]━━━━[NOVAS MATRÍCULAS]`
- **Seção "Cadência de tarefas":**
  - Atividades configuradas para esta coluna específica
  - Empty state: "Nenhuma atividade configurada para esta coluna"
  - → Tabela `stage_task_cadences` (atividades padrão por coluna)

---

#### Aba 2 — Atividades
Duas sub-seções:
1. **"Histórico de Atividades"** — lista das atividades criadas/concluídas
2. **"Criar atividade"** — formulário inline:

| Campo | Tipo | Detalhe |
|-------|------|---------|
| Tipo | Dropdown | "Lembrete" confirmado, outros tipos em dropdown |
| Responsável | Dropdown agentes | |
| Assunto | Text input | |
| Agendar para | Datetime picker | |
| Duração (min) | Number | default: 30 |
| Anexo | File upload | doc/imagem |
| Nota | Rich text editor | B · I · U · lista com bullets · lista numerada |

→ Tabela `deal_activities` necessária com campos: `type_enum`, `responsible_agent_id`, `subject`, `scheduled_at`, `duration_minutes`, `attachment_url`, `notes_html`, `deal_id`, `created_by_agent_id`, `completed_at`.

---

#### Aba 3 — Histórico
- **Título:** "Histórico de eventos"
- **Filtro:** dropdown "Todos" (implica outros filtros: Transferências, Notas, etc.)
- **Tipos de evento registrados automaticamente:**

| Tipo | Formato do texto |
|------|-----------------|
| Transferência de Etapa | `"ATENDIMENTOS - GERAL -> SECRETARIA para ATENDIMENTOS - GERAL -> AGUARDANDO"` |
| Ticket Transferido | Texto de atribuição de agente |

- Eventos são **imutáveis** — gerados por triggers do backend, não editáveis pelo usuário
- → Tabela `deal_history_events` com campos: `deal_id`, `event_type ENUM`, `description TEXT`, `created_by_agent_id`, `created_at`

---

#### Aba 4 — Notas
- Textarea livre: placeholder "Escreva uma nota..."
- Ícone 📎 para anexar arquivo
- Botão enviar
- Notas salvas aparecem como lista (timestamp + texto + agente)
- → Tabela `deal_notes` com `deal_id`, `agent_id`, `content TEXT`, `attachment_url`, `created_at`

---

**Gap no schema Sprint 1:** Falta `deals` (negócios), `pipeline_stages`, `pipelines`, `campaigns`.

---

### 2.4 CRM Contatos (`/contacts`) ⭐ CORE
**O que é:** Tabela de contatos com gestão completa.
- 245 contatos — Avatar, Nome, Número, Email, Criado em, Ações
- **Tags coloridas** com color picker modal (20px circles, 16px border-radius)
- **Importar/Exportar** (CSV drag-and-drop)
- **Mostrar duplicatas** checkbox + modal de merge
- Busca + filtro por tag (autocomplete)
- Ações por linha: WhatsApp · Ligar · Editar · Deletar

**Gap no schema Sprint 1:** tags com cor nos contatos, merge de duplicatas, import/export.

---

### 2.5 Relatórios (`/reports`) 📊
**O que é:** Dashboard de métricas com gráficos customizáveis.

- **Filtro de período:** range de datas (ex: 01/04 - 12/04)
- **Filtro de tipo de métrica (6 tipos):**
  1. Vendas
  2. Atividades
  3. Conversas
  4. Ligações
  5. SDR
  6. Closer
- **Filtro de usuário:** dropdown com os 5 agentes (Suporte · Marcelo Falcão · Cristina Passos · Jhiully Lages · Fabiano Silva)
- **Modal "Adicionar Gráfico Personalizado":**
  - Campo: Nome do gráfico
  - Campo: Cargo para filtrar
  - Toggle: Exibir percentuais
- **Gráficos:** ApexCharts (barras e linhas)

**Gap no schema Sprint 1:** Sem tabelas de métricas/agregação. Sprint 7 resolve.

---

### 2.6 Recursos: Modelos de Mensagem (`/message-templates`) ⭐ IMPORTANTE
**O que é:** WABA templates do WhatsApp Business.
- Seletor de conta: **"Faculdades Integradas de Cassilândia - WABA"** ← FIC já tem!
- Grid `repeat(auto-fill, minmax(350px, 1fr))`
- **Sincronizar** com Meta API
- Preview do template em estilo WhatsApp (bg `#075e54`, bubble `#dcf8c6`)
- Botões de ação no template: Quick Reply, URL, etc.
- **Fluxo de uso:** quando janela 24h está fechada, operador seleciona template no modal "Selecionar modelo de mensagem" antes de poder enviar qualquer mensagem

**Gap no schema Sprint 1:** Tabela `whatsapp_templates` existe mas falta sync com Meta + WABA channel linking.

---

### 2.7 Recursos: Chat Interno (`/chats`) 💬
**O que é:** Chat interno entre agentes da equipe.
- 2 painéis: lista de conversas (33%) / área de chat (67%)
- Avatar azul `#345EF3`, nome do grupo, preview última mensagem
- Badge de não lido
- "Nova Conversa" CTA

**Gap no schema Sprint 1:** Falta tabelas de chat interno (`team_chats`, `team_messages`).

---

### 2.8 Automações (`/automations`)
**O que é:** Regras de automação para roteamento e respostas.
- Gatilhos + condições + ações
- **Automações de Colunas CRM:** visíveis na home como widget separado — automações específicas por coluna do kanban (ex: "quando card entra em NOVAS MATRÍCULAS → enviar template de boas-vindas")

**Schema Sprint 1:** Tabela `automation_rules` existe. Precisamos de UI. Sprint 8.

---

### 2.9 Canais de Atendimento (`/channels`)
**O que é:** Config de canais (WhatsApp, Instagram, etc).
- 3 canais na FIC:
  - Instagram FIC (desconectado — ícone vermelho)
  - WABA FIC (conectado — ícone verde)
  - WhatsApp Antigo FIC
- Relacionado com `inboxes` no nosso schema.

---

### 2.10 Integração N8N
**O que é:** Automação via N8N conectada ao Nexvy.
- Visível via `Gerenciar Integração` dentro do header da conversa
- Badge: "N8N - AF EDUCACIONAL"
- **Implicação para ERP:** nosso módulo de automações (Sprint 8) pode ter integração N8N nativa — a FIC já tem N8N configurado, então podemos criar triggers N8N → ERP Atendimento.

---

### 2.11 Agentes de IA (feature avançada)
**O que é:** Painel de agentes autônomos com monitoramento.
- Widget na home: `0 agente em atividade · 0 erros recentes`
- FIC não tem agentes ativos por enquanto, mas a feature existe
- **Relevância para ERP:** poderíamos implementar nosso próprio "Agente de Atendimento" autônomo como Sprint 9+

---

### 2.12 DS Voice — Biblioteca de Conteúdo + Automações ⭐ DESCOBERTA IMPORTANTE

> ⚠️ **Correção batch 2:** DS Voice NÃO é apenas VoIP Twilio. É um módulo completo de **biblioteca de conteúdo pré-salvo + automações de disparo** para WhatsApp/Instagram. O VoIP é uma feature menor dentro dele.

**O que é:** Sistema de biblioteca de mensagens salvas + funis de automação (sequências com delay) + gatilhos que disparam funis automaticamente quando mensagens chegam.

#### Sub-módulos DS Voice:

---

##### 2.12.1 Mensagens (`/ds-voice/messages`)
Biblioteca de templates de mensagens de texto reutilizáveis.

- **Grid de cards:** cada card = uma mensagem salva
- **Variáveis dinâmicas suportadas:** `{Nome Completo}` · `{Primeiro Nome}` · `{Saudação}`
- **Por mensagem:**
  - Campo: texto com suporte às variáveis
  - Toggle: **"Visível para todos"** — se desmarcado, só o criador vê
  - Toggle: **"Editar ao enviar"** — permite agente customizar antes de enviar
  - Organização por **pastas** (sidebar de pastas)
- → Tabela `ds_voice_messages` com `content`, `folder_id`, `visible_to_all BOOL`, `editable_on_send BOOL`, `variables JSONB`

---

##### 2.12.2 Áudios (`/ds-voice/audios`)
Biblioteca de áudios pré-gravados para WhatsApp.

- **Upload:** drag-and-drop de `.mp3` / `.ogg` · limite **≤ 16MB**
- **Por áudio:**
  - Nome + duração
  - Toggle: **"Enviar como gravado na hora"** — exibe como mensagem de voz nativa do WhatsApp (ícone microfone) em vez de arquivo de áudio
  - Organização por **pastas**
- → Tabela `ds_voice_audios` com `file_url`, `file_size`, `duration_seconds`, `folder_id`, `send_as_voice_message BOOL`

---

##### 2.12.3 Mídias (`/ds-voice/medias`)
Biblioteca de imagens e vídeos.

- **Imagens:** ≤ 5MB
- **Vídeos:** ≤ 100MB
- **Por mídia:**
  - Preview thumbnail
  - Campo opcional: **legenda** (textarea — caption da imagem/vídeo)
  - Organização por **pastas**
- → Tabela `ds_voice_media` com `file_url`, `media_type ENUM('image','video')`, `file_size`, `caption TEXT`, `folder_id`

---

##### 2.12.4 Documentos (`/ds-voice/documents`)
Biblioteca de documentos (PDF, DOCX, etc).

- **Limite:** ≤ 100MB
- **Por documento:**
  - Nome do arquivo + tipo
  - Organização por **pastas**
- → Tabela `ds_voice_documents` com `file_url`, `file_name`, `file_size`, `file_type`, `folder_id`

> ⚠️ **Atenção Instagram:** PDFs, DOCS e Planilhas **NÃO são suportados no Instagram**. Apenas no WhatsApp. Exibir aviso de incompatibilidade no momento de usar documento em canal Instagram.

---

##### 2.12.5 Funis (`/ds-voice/funnels`)
Construtor de sequências automatizadas com delay (drip sequences).

- **Por funil:**
  - Campo: **Nome do Funil**
  - Lista de etapas — botão `+ Adicionar nova etapa`
  - Cada etapa: tipo de conteúdo (mensagem / áudio / mídia / documento) + **delay em segundos**
  - Contador: `Duração total do funil: X segundos`
  - Toggle: **"Visível para todos"** (compartilhamento entre agentes)
- **Fluxo:** funil é uma sequência ordenada de envios com intervalos de tempo
- → Tabela `ds_voice_funnels` com `name`, `visible_to_all BOOL`  
  → Tabela `ds_voice_funnel_steps` com `funnel_id`, `position`, `content_type ENUM`, `content_id UUID`, `delay_seconds INT`

---

##### 2.12.6 Gatilhos (`/ds-voice/triggers`)
Automações que disparam funis quando mensagens chegam.

**Formulário do Gatilho:**
| Campo | Tipo | Detalhe |
|-------|------|---------|
| Nome | Text | Nome do gatilho |
| Tags | Multi-select | Tags que o contato deve ter |
| Funil | Dropdown | Funil a disparar |
| Delay | Number (segundos) | Espera antes de iniciar o funil |
| Condição da mensagem | Texto livre | Palavra/frase que aciona o gatilho (`+ Condição`) |
| Não enviar p/ contatos salvos | Toggle | Ignora contatos já na agenda |
| Não enviar p/ Grupos | Toggle | Ignora grupos WhatsApp |
| Ignorar Maiúsculas e Minúsculas | Toggle | Case insensitive matching |
| Disparar no WhatsApp | Toggle | Ativo por padrão |
| Disparar no Instagram | Toggle | Ativo por padrão |

> ⚠️ **Aviso exibido:** "PDFs, DOCS e Planilhas não são suportados pelo Instagram" — exibido quando Instagram está ativo e o funil contém documentos.

- → Tabela `ds_voice_triggers` com `name`, `funnel_id`, `delay_seconds`, `condition_text`, `ignore_saved_contacts BOOL`, `ignore_groups BOOL`, `case_insensitive BOOL`, `active_whatsapp BOOL`, `active_instagram BOOL`, `tags JSONB`

---

##### 2.12.7 Configurações DS Voice (`/ds-voice/settings`)
- **Export:** baixar backup completo como `.json`
- **Import:** restaurar a partir de `.json` (portabilidade entre ambientes)
- Útil para replicar configuração entre staging e produção

---

**Decisão ERP:**
O módulo DS Voice (como biblioteca de conteúdo + funis + gatilhos) é **relevante para o Sprint 8+** do ERP Atendimento. A FIC certamente usa isso para respostas automáticas. Implementar após o core (Sprint 2-4).

O VoIP (chamadas telefônicas Twilio dentro do DS Voice) permanece **fora do escopo inicial**.

---

### 2.13 DS Track (Rastreamento) 📈
**Decisão FIC:** Fora do escopo — é produto separado. Não implementar no ERP.

---

## 3. Gap Analysis — Sprint 1 Schema vs Nexvy

### Tabelas que existem e estão OK ✅
| Tabela Sprint 1 | Corresponde a |
|----------------|---------------|
| `inboxes` | Canais de atendimento (WhatsApp inbox) |
| `contacts` | CRM Contatos (base) |
| `conversations` | Tickets/Conversas |
| `messages` | Mensagens do chat |
| `labels` | Tags coloridas |
| `conversation_labels` | Labels M2M |
| `agents` | Usuários/atendentes |
| `automation_rules` | Automações |
| `whatsapp_templates` | Modelos de mensagem |

### Tabelas FALTANDO — Críticas para o MVP ❌
| Tabela Faltante | Módulo Nexvy | Prioridade |
|----------------|--------------|-----------|
| `queues` | Filas de atendimento (distinct de inbox) | P1 |
| `conversation_queues` | M2M conversation↔queue | P1 |
| `deals` | CRM Negócios / Kanban | P1 |
| `pipelines` | Pipeline container (multi-pipeline confirmado) | P1 |
| `pipeline_stages` | Colunas do Kanban (AGUARDANDO, etc) | P1 |
| `protocols` | Protocolos por ticket (múltiplos por conversa) | P1 |
| `contact_tags` | Tags nos contatos com cor | P2 |
| `conversation_transfers` | Histórico de transferências | P2 |
| `agent_statuses` | Status/pausa do agente | P2 |
| `canned_responses` | Respostas rápidas | P2 |
| `saved_views` | Abas customizadas por agente | P2 |
| `deal_activities` | Atividades agendadas por negócio 🆕 | P2 |
| `deal_history_events` | Log imutável de eventos do deal 🆕 | P2 |
| `deal_notes` | Notas livres por deal 🆕 | P2 |
| `contact_custom_fields` | Campos personalizados por contato 🆕 | P2 |
| `stage_task_cadences` | Atividades padrão por coluna do pipeline 🆕 | P2 |
| `campaigns` | Campanhas (filtro do kanban) 🆕 | P2 |
| `automation_executions` | Log de automações por coluna 🆕 | P3 |
| `ds_voice_messages` | Biblioteca de mensagens DS Voice 🆕 | P3 |
| `ds_voice_audios` | Biblioteca de áudios DS Voice 🆕 | P3 |
| `ds_voice_media` | Biblioteca de mídias DS Voice 🆕 | P3 |
| `ds_voice_documents` | Biblioteca de documentos DS Voice 🆕 | P3 |
| `ds_voice_funnels` | Funis de automação DS Voice 🆕 | P3 |
| `ds_voice_funnel_steps` | Etapas dos funis DS Voice 🆕 | P3 |
| `ds_voice_triggers` | Gatilhos de disparo DS Voice 🆕 | P3 |
| `ds_voice_folders` | Pastas para organização da biblioteca 🆕 | P3 |
| `products` | Produtos vinculáveis a deals 🆕 | P3 |
| `team_chats` | Chat interno | P3 |
| `team_messages` | Mensagens chat interno | P3 |
| `metrics_snapshots` | Dashboard/relatórios | P3 |

### Campos faltando nas tabelas existentes
| Tabela | Campos faltando |
|--------|----------------|
| `contacts` | `color` (avatar), `avatar_url`, `phone_number`, `has_duplicates` |
| `conversations` | `queue_id`, `deal_id`, `last_read_at`, `waiting_since`, `response_count`, `ticket_number` (auto-increment visível) |
| `messages` | `status` (sent/delivered/read), `media_type`, `media_url`, `waba_template_id` |
| `labels` | `color_hex` (confirmar se já existe) |
| `agents` | `status` (online/offline/paused), `pause_reason`, `avatar_url` |
| `whatsapp_templates` | `waba_account_id`, `template_category`, `language_code`, `status` (approved/pending/rejected) |

### Novas tabelas detalhadas (descobertas dos prints) 🆕

#### `protocols`
```sql
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  protocol_number BIGSERIAL UNIQUE,  -- ex: #2010351
  status TEXT CHECK (status IN ('em_andamento', 'fechado', 'aguardando')),
  responsible_agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  account_id UUID NULL
);
```

#### `saved_views`
```sql
CREATE TABLE saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  name TEXT NOT NULL,
  filters JSONB NOT NULL,  -- {pipeline_id, stage_id, tags[], agent_ids[], status[]}
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
```

#### `deal_activities` 🆕
```sql
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('lembrete', 'reuniao', 'ligacao', 'tarefa', 'outro')),
  responsible_agent_id UUID REFERENCES agents(id),
  subject TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 30,
  attachment_url TEXT,
  notes_html TEXT,
  completed_at TIMESTAMPTZ,
  created_by_agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
```

#### `deal_history_events` 🆕
```sql
-- Imutável — gerado por trigger no backend, nunca editável
CREATE TABLE deal_history_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN ('stage_transfer', 'ticket_transferred', 'note_added', 'activity_created', 'deal_created')),
  description TEXT NOT NULL,  -- ex: "ATENDIMENTOS - GERAL -> SECRETARIA para ATENDIMENTOS - GERAL -> AGUARDANDO"
  created_by_agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
```

#### `deal_notes` 🆕
```sql
CREATE TABLE deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  content TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
```

#### `contact_custom_fields` 🆕
```sql
CREATE TABLE contact_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,   -- "Nome do campo" digitado pelo agente
  field_value TEXT,           -- "Valor" digitado
  created_by_agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
```

#### `stage_task_cadences` 🆕
```sql
-- Atividades padrão pré-configuradas por coluna do pipeline
CREATE TABLE stage_task_cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  delay_days INT DEFAULT 0,    -- dias após entrar na coluna
  duration_minutes INT DEFAULT 30,
  notes_template TEXT,
  position INT DEFAULT 0,
  account_id UUID NULL
);
```

#### `campaigns` 🆕
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('ativa', 'pausada', 'encerrada')) DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
-- M2M contact↔campaign:
CREATE TABLE contact_campaigns (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, campaign_id)
);
```

#### `automation_executions` 🆕
```sql
CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id UUID REFERENCES automation_rules(id),
  pipeline_stage_id UUID REFERENCES pipeline_stages(id),
  deal_id UUID REFERENCES deals(id),
  status TEXT CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID NULL
);
```

#### DS Voice — Tabelas completas 🆕
```sql
-- Pastas de organização compartilhadas entre os 4 tipos
CREATE TABLE ds_voice_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('messages','audios','media','documents')),
  account_id UUID NULL
);

-- Mensagens de texto
CREATE TABLE ds_voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES ds_voice_folders(id),
  content TEXT NOT NULL,           -- template com {variáveis}
  variables JSONB,                 -- lista de vars detectadas
  visible_to_all BOOL DEFAULT true,
  editable_on_send BOOL DEFAULT false,
  created_by UUID REFERENCES agents(id),
  account_id UUID NULL
);

-- Áudios
CREATE TABLE ds_voice_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES ds_voice_folders(id),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INT,
  duration_seconds INT,
  send_as_voice_message BOOL DEFAULT false,
  account_id UUID NULL
);

-- Mídias (imagens e vídeos)
CREATE TABLE ds_voice_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES ds_voice_folders(id),
  name TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image','video')),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes INT,
  caption TEXT,
  account_id UUID NULL
);

-- Documentos
CREATE TABLE ds_voice_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES ds_voice_folders(id),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,   -- 'pdf', 'docx', 'xlsx'
  file_size_bytes INT,
  account_id UUID NULL
);

-- Funis (sequências)
CREATE TABLE ds_voice_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  visible_to_all BOOL DEFAULT true,
  total_duration_seconds INT DEFAULT 0,  -- calculado
  account_id UUID NULL
);

CREATE TABLE ds_voice_funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES ds_voice_funnels(id) ON DELETE CASCADE,
  position INT NOT NULL,
  content_type TEXT CHECK (content_type IN ('message','audio','media','document')),
  content_id UUID NOT NULL,   -- FK para a tabela do tipo
  delay_seconds INT DEFAULT 0,
  account_id UUID NULL
);

-- Gatilhos (triggers)
CREATE TABLE ds_voice_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  funnel_id UUID REFERENCES ds_voice_funnels(id),
  delay_seconds INT DEFAULT 0,
  condition_text TEXT,            -- palavra/frase que dispara
  case_insensitive BOOL DEFAULT true,
  ignore_saved_contacts BOOL DEFAULT false,
  ignore_groups BOOL DEFAULT true,
  active_whatsapp BOOL DEFAULT true,
  active_instagram BOOL DEFAULT true,
  tags JSONB,                     -- tags dos contatos elegíveis
  active BOOL DEFAULT true,
  account_id UUID NULL
);
```

---

## 4. Design Tokens Nexvy (para referenciar)

```css
/* Cores principais */
--primary: #345EF3;
--success: #4caf50;
--error: #fd3a55;
--warning: #ff9800;
--info: #2196f3;

/* WhatsApp */
--wa-bg: #075e54;
--wa-bubble-out: #dcf8c6;
--wa-bubble-in: #ffffff;
--wa-green: #25d366;

/* Instagram */
--ig-pink: #e1306c;

/* Status dots */
--dot-active: #4caf50;
--dot-inactive: #ff1414;
--dot-paused: #ff9800;

/* Layouts */
--left-panel-width: 320px;
--right-panel-width: 320px;
--kanban-col-width: 300px;
--pipeline-drawer-width: 480px;
--border-radius-card: 8px;
--border-radius-bubble: 8px 18px 18px 8px;  /* incoming */
--border-radius-bubble-out: 18px 8px 18px 18px;  /* outgoing */
--border-radius-modal: 24px;
--border-radius-glass: 24px;

/* Glass modal */
--glass-bg: rgba(255,255,255,0.96);
--glass-backdrop: blur(20px) saturate(180%);
--glass-shadow: 0 24px 48px 0 rgba(31,38,135,0.18);

/* Scrollbar */
--scrollbar-width: 3px;
--scrollbar-color: #345EF3;

/* Tipografia */
--font-family: Instrument Sans;

/* Kanban */
--kanban-height: calc(100vh - 90px);
--kanban-col-min: 300px;
--kanban-col-max: 300px;
```

---

## 5. Padrões de UX Confirmados nos Prints

### 5.1 Fluxo de Janela WhatsApp Fechada
1. Agente abre conversa cuja janela de 24h está expirada
2. **Banner amarelo** aparece no topo do chat: "Janela de conversação fechada"
3. Input de texto fica **desabilitado**
4. Agente clica no ícone de templates (funil) na barra de input
5. Modal "Selecionar modelo de mensagem" abre
6. Agente seleciona um template WABA aprovado
7. Template é enviado → janela reabre por 24h
8. Chat volta ao normal

**Implicação schema:** campo `window_expires_at TIMESTAMPTZ` na tabela `conversations`.

### 5.2 Breadcrumb Pipeline no Chat
- Header do chat exibe: `NOME_DO_PIPELINE › NOME_DA_COLUNA`
- Clickável para mover para outra coluna diretamente do chat
- Mantém sincronia bidirecional: chat → kanban, kanban → chat

### 5.3 Toolbar de Anexos (5 tipos)
| Ícone | Tipo | Descrição |
|-------|------|-----------|
| 🔽 Funil | Templates | Abre modal de seleção de templates WABA |
| T | Texto | Rich text / formatação |
| 🎤 | Áudio | Gravação de voz |
| 📷 | Imagem | Upload de foto/imagem |
| 📄 | Documento | Upload de arquivo (PDF, etc) |

### 5.4 Sistema de Abas Customizadas
- Cada agente cria suas próprias "views" salvas
- Filtros combinados: Pipeline + Coluna + Tags + Responsáveis + Status
- Aparece como aba extra na lista de conversas
- **Útil para:** "Minhas conversas em NOVAS MATRÍCULAS" ou "Leads com tag #vestibular"

### 5.5 Protocolos por Ticket
- Ticket = identificador imutável da conversa (ex: #1897217)
- Protocolo = instância de atendimento dentro do ticket (ex: #2010351)
- Uma conversa pode ter múltiplos protocolos ao longo do tempo
- Cada protocolo tem responsável + status + histórico

---

## 6. Roadmap de Sprints — Módulo Atendimento (atualizado)

### Sprint 2 — Webhook WhatsApp + Recepção de Mensagens 🔥 PRÓXIMO
**Objetivo:** Receber mensagens reais do WhatsApp e salvar no banco.

| Item | Descrição | Estimativa |
|------|-----------|-----------|
| Webhook Meta Cloud API | POST `/api/atendimento/webhook` com HMAC-SHA256 | 4h |
| Bull Queue Railway | Fila de processamento de mensagens entrantes | 3h |
| Message processor | Salvar em `messages` + criar/atualizar `conversations` | 4h |
| Contact upsert | Criar contato novo ou vincular ao existente via número | 2h |
| Status delivery | Atualizar status de mensagem (sent/delivered/read) | 2h |
| window_expires_at | Campo nas conversations + lógica de expiração | 1h |
| **Total** | | **~16h** |

**Pré-requisito:** Meta Cloud API token + phone number ID da FIC (obter com Marcelo).

---

### Sprint 3 — Inbox 3 Painéis (UI Core) 🎨
**Objetivo:** Interface de atendimento navegável, estilo Nexvy.

| Item | Descrição |
|------|-----------|
| Painel esquerdo 320px | Lista de conversas com busca + filtro canal/status + badge não lido |
| Abas padrão | Todas · Em atendimento · Aguardando · Minhas · Não atribuídas |
| Painel central | Chat com bubbles in/out + toolbar 5 tipos + textarea |
| Header chat | Breadcrumb pipeline + gerenciar agente + ações |
| Banner janela fechada | Aviso + disable input + CTA template |
| Painel direito | Tabs: Informações / Histórico / Negócios |
| DB migrations | `queues`, `queue_id` em conversations, `window_expires_at`, `ticket_number` |

---

### Sprint 4 — CRM Kanban Pipeline 🗂️
**Objetivo:** Kanban de negócios completo com lead detail modal.

| Item | Descrição |
|------|-----------|
| Migrations | `pipelines`, `pipeline_stages`, `deals`, `campaigns` |
| Pipeline padrão FIC | Seed: 2 pipelines (ATENDIMENTOS-GERAL + Alunos), 4 etapas |
| Kanban board | Colunas 300px, drag & drop, horizontal scroll, `height: calc(100vh - 90px)` |
| Toggle visualizar mensagens | Compact vs message_preview |
| Column ⋮ menu | Editar · Transferir negócios · Baixar CSV · Execuções de Automação |
| Filtros kanban | Tags · Campanhas · Filas · Período · checkboxes |
| Lead detail modal | Layout 2 colunas: painel esquerdo (7 ações + custom fields) + 4 tabs |
| Tab Negócios | Progress bar de etapas + cadência de tarefas |
| Tab Atividades | Criar atividade com rich text + tipo + agendamento |
| Tab Histórico | Log imutável de eventos (stage_transfer, ticket_transferred) |
| Tab Notas | Textarea livre + anexo |
| Deal card | Avatar + nome + valor + Ver Conversa + Selecionar agente |
| Breadcrumb bidirecional | `deal_id` em conversations, stage visível no header do chat |
| Protocols | Tabela `protocols` + modal + número sequencial |
| Migrations novas | `deal_activities`, `deal_history_events`, `deal_notes`, `contact_custom_fields`, `stage_task_cadences`, `automation_executions` |

---

### Sprint 5 — Templates WABA + Envio ativo 📤
**Objetivo:** Usar os templates WABA da FIC para iniciar conversas.

| Item | Descrição |
|------|-----------|
| Sync templates | GET Meta API → salvar em `whatsapp_templates` |
| UI templates | Grid de cards com preview estilo WhatsApp |
| Envio ativo | POST mensagem com template via Meta API |
| Fluxo janela fechada | Modal template integrado ao chat quando 24h expirado |
| Histórico | Marcar mensagem como `type: template` na thread |

---

### Sprint 6 — Gestão de Contatos + Tags 👥
**Objetivo:** CRM de contatos completo.

| Item | Descrição |
|------|-----------|
| Color picker | Tags com cor hex para contatos |
| Import CSV | Drag-and-drop upload, validação, upsert |
| Export CSV | Download filtrado |
| Detecção de duplicatas | Por número de telefone (normalizado) |
| Merge modal | Interface para selecionar dados canônicos |
| Saved Views | Tabela `saved_views` + modal "Nova Aba Customizada" |

---

### Sprint 7 — Dashboard / Relatórios 📊
**Objetivo:** Métricas operacionais da secretaria.

| Item | Descrição |
|------|-----------|
| 6 tipos de relatório | Vendas · Atividades · Conversas · Ligações · SDR · Closer |
| Filtros | Data · Usuário/agente · Tipo |
| Gráficos customizáveis | Modal "Adicionar Gráfico Personalizado" + nome + cargo |
| ApexCharts | Barras e linhas com toggle percentuais |
| Snapshots | Job diário que agrega métricas em `metrics_snapshots` |
| Widget Home | Cards de resumo (como Nexvy home) |

---

### Sprint 8 — Chat Interno + Automações UI + N8N 💬
**Objetivo:** Comunicação interna + regras de automação configuráveis + integração N8N.

| Item | Descrição |
|------|-----------|
| Chat interno | 2 painéis, grupos, mensagens em tempo real (Supabase Realtime) |
| Automações UI | CRUD de regras (gatilho + condição + ação) |
| Automações de Coluna | Regras específicas por coluna do kanban (como Nexvy) |
| Auto-assign | Regra: quando conversa entra → atribuir ao agente com menos carga |
| Mensagem de boas-vindas | Auto-reply no início de conversa nova |
| N8N Webhook | Trigger N8N quando evento ocorre no ERP (FIC já usa N8N) |

---

### Sprint 9 — DS Voice: Biblioteca de Conteúdo + Funis + Gatilhos 📚
**Objetivo:** Replicar o módulo DS Voice do Nexvy — biblioteca de mensagens/áudios/mídias/docs + funis + gatilhos automáticos.

| Item | Descrição |
|------|-----------|
| Migrations | Todas as tabelas `ds_voice_*` + `ds_voice_folders` |
| Biblioteca Mensagens | CRUD com pastas + variáveis `{Nome}` `{Primeiro Nome}` `{Saudação}` + toggles |
| Biblioteca Áudios | Upload .mp3/.ogg ≤16MB + toggle "enviar como gravação" |
| Biblioteca Mídias | Upload imagem ≤5MB / vídeo ≤100MB + caption |
| Biblioteca Documentos | Upload ≤100MB + aviso incompatibilidade Instagram |
| Construtor de Funis | Steps ordenados com delay + tipo de conteúdo |
| Gatilhos | Form completo (condição + funil + toggles WhatsApp/Instagram) |
| Export/Import .json | Backup e restauração da biblioteca |

---

## 7. Decisões de Arquitetura

### O que construímos (nosso, do zero)
- Banco PostgreSQL (Supabase) — schema próprio
- Next.js frontend — componentes próprios com MUI v5
- Railway para jobs pesados (webhook processor, Bull Queue)
- Supabase Realtime para mensagens em tempo real
- Numeração de tickets: BIGSERIAL auto-increment (visível como #1897217)
- Protocolos: numeração separada de tickets

### O que usamos como referência visual (Nexvy)
- Layout 3 painéis do inbox (320px / flex / 320px)
- Kanban com colunas 300px e drag & drop (smooth-dnd)
- Color scheme para bubbles de chat
- Glass modal design pattern (`blur(20px)`, `border-radius: 24px`)
- Tags coloridas com color picker
- Header com breadcrumb de pipeline
- Toolbar 5 tipos de anexo
- Abas customizadas (saved views)
- Banner de janela fechada WhatsApp

### O que NÃO fazemos (fora do escopo ERP)
- DS Track / atribuição de campanhas
- DS Voice VoIP / chamadas Twilio (Fase 2+) — só a biblioteca de conteúdo vai (Sprint 9)
- Multi-tenant SaaS (Fase 2 — quando extrair Nexvy próprio)

### Estratégia single-tenant → multi-tenant
Todas as tabelas têm `account_id UUID NULL` para facilitar a extração multi-tenant futura.
Sprint 1 popula `account_id = null` (single-tenant FIC).
Quando virar SaaS: adicionar `account_id NOT NULL` + RLS por account.

### Integração N8N (FIC já usa)
A FIC tem N8N conectado ao Nexvy via "N8N - AF EDUCACIONAL".
Nosso ERP deve expor webhooks que o N8N da FIC pode consumir desde o Sprint 8.
Isso permite que automações existentes no N8N da FIC continuem funcionando via ERP.

---

## 8. Time de Agentes da FIC (referência para seeds)

| Nome | Role no Nexvy |
|------|--------------|
| Suporte | Agente de suporte |
| Marcelo Falcão | Admin / Responsável |
| Cristina Passos | Agente |
| Jhiully Lages | Agente |
| Fabiano Silva | Agente |

Seed inicial do módulo Atendimento deve criar esses 5 agentes vinculados ao `account_id` da FIC.

---

## 9. Próxima Ação Imediata

**Sprint 2 começa quando Marcelo trouxer:** 
1. **Meta Cloud API token** (Business Manager FIC)
2. **Phone Number ID** da conta WhatsApp da FIC
3. **WABA Account ID** (visível em Canais de Atendimento no Nexvy → configurações da conta WABA)

Com essas credenciais, o webhook pode ser configurado em Railway e apontado no Meta Developer Console.

---

*Referência extraída em 12/04/2026 via análise de 21 arquivos .md (sessão 086) + 22 screenshots batch 1 + 38 screenshots batch 2 (sessão 087). Batch 3+ em andamento.*  
*Módulos analisados: home, dashboard, tickets (3-panel), atividade, negócios/kanban (lead detail modal completo), canais, tags, contatos, DS Voice (biblioteca + funis + gatilhos), dstrack (descartado), recursos/templates, recursos/chat-interno, canais-atendimento, agendamentos, automações, administração.*
