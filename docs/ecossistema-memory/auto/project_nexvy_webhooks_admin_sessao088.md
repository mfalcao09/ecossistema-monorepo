---
name: Nexvy CRM — Webhooks, Canais, Usuários, Cargos, Financeiro, Widgets e Configurações (Sessão 088 Batch 9)
description: Mapeamento completo de Webhooks (entrada/saída), Canais de Atendimento (3 canais FIC), Administração (Usuários, Cargos com permissões granulares, Financeiro, Widgets, Configurações gerais)
type: project
---

## Webhooks (`/webhooks`)

### Webhook de Entrada
- Estado atual: vazio — "Nenhum webhook de entrada"
- Modal **Novo Webhook** (2 passos):
  1. Nome do webhook
  2. Tags automáticas (atribuídas ao lead ao entrar por esse webhook)
- Finalidade declarada: "Configure um endpoint para receber leads"

### Webhook de Saída
- Estado atual: vazio — "Nenhum webhook de saída"
- Modal **Novo Webhook de Saída**:
  - **URL** — endpoint externo que receberá os eventos
  - **Número de tentativas** — padrão: 1
  - **Toggle Ativo** — on/off
  - **Eventos disponíveis:**
    - **Comercial:** botão "Marcar todos" + lista de eventos individuais
    - **Canal de atendimento:** botão "Marcar todos" + lista de eventos individuais

---

## Canais de Atendimento (`/connections`)

**Resumo:** 3/6 canais utilizados — 3 disponíveis para adicionar.

| # | Nome | Tipo | Número/ID | Status |
|---|------|------|-----------|--------|
| 1 | Faculdades Integradas de Cassilândia – FIC | Instagram Business | — | ✅ Conectado |
| 2 | Faculdades Integradas de Cassilândia – WABA | WhatsApp Business Platform API | +55 (67) 9 3618-0058 | ✅ Conectado |
| 3 | Whats Antigo – FIC | WhatsApp não oficial (Baileys) | +55 (67) 9 8447-1955 | ❌ Desconectado |

**Canal 3 (Baileys desconectado):** botões disponíveis: "Tentar novamente" e "Novo QR CODE"

### Modal — Adicionar Canal (3 tipos)

| Tipo | Estabilidade | Observação |
|------|-------------|------------|
| WhatsApp Padrão | ⚠️ Instável | Risco de banimento da conta |
| WhatsApp Business META | ✅ Estável | Pode incluir custos adicionais (Meta) |
| Instagram | — | Canal de Instagram Business |

---

## Administração → Usuários (`/users`)

### Usuários Cadastrados

| Nome | Email | Perfil | Status |
|------|-------|--------|--------|
| Fabiano Silva | buscasjp@gmail.com | admin | ⏸️ Pausado: Conversas e Ligações |
| Jhiully Lages | jhiully.lages@afeducacional.com.br | user | ⏸️ Pausado: Conversas e Ligações |
| Cristina Passos | cristina.passos@afeducacional.com.br | user | ⏸️ Pausado: Conversas e Ligações |
| Marcelo Falcão | marcelo.falcao@afeducacional.com.br | admin | ⏸️ Pausado: Conversas e Ligações |

**Observação:** todos os 4 usuários estão com status "Pausado: Conversas e Ligações".

### Modal — Adicionar Usuário

| Campo | Detalhe |
|-------|---------|
| Nome | Campo texto |
| Email | Campo email |
| Perfil | Admin \| User |
| Senha | Campo senha (oculto) |
| Senha temporária | Toggle on/off |
| Filas | Multi-select de filas |
| Cargos | Multi-select de cargos |
| Canal de atendimento Padrão | Whats Antigo – FIC \| Faculdades Integradas de Cassilândia – WABA |
| Vincular com Google | Botão de integração OAuth |

---

## Administração → Cargos (`/roles`)

- Estado atual: lista vazia (0-0 de 0)

### Tipos de Cargo Disponíveis
- Padrão
- Pré-vendedor (SDR)
- Pré-vendedor (BDR)
- Vendedor (CLOSER)
- Suporte
- Atendente

### Permissões Granulares (por módulo)
Todos os módulos abaixo possuem toggles individuais configuráveis por cargo:

| Módulo | Sub-módulos |
|--------|-------------|
| Início | — |
| Relatórios | — |
| Conversas | — |
| DS Voice | — |
| CRM | Negócios, Central de Atividades, Calls, Contatos, Tags, Produtos |
| DS Track | Visão Geral, Campanhas, Visitantes, Leads, Mensagens, Integração |
| Recursos | Chats, Agendamentos, Modelos de Mensagem, Links de Redirecionamento, Biblioteca de Vídeos |
| Automações | DS Agente, DS Bot, Integrações, Filas, API, Webhooks |
| Canais de Atendimento | — |

---

## Administração → Financeiro (`/financeiro`)

| Campo | Valor |
|-------|-------|
| Assinatura ID | **8379** |
| Status | **Ativo** |
| Data Vencimento | **06/03/2027** |
| Pedido vinculado | Nenhum — "Esta assinatura não possui um pedido vinculado." |

---

## Administração → Widgets (`/widgets`)

- Estado atual: vazio — "Nenhum widget encontrado"

### Modal — Novo Widget

| Campo | Detalhe |
|-------|---------|
| Nome | Campo texto |
| URL | Suporta parâmetros dinâmicos: `{{user.email}}` e `{{user.id}}` |
| Ícone | 9 opções: Link Externo, Configurações, Gráficos, Usuários, Documentos, Email, Telefone, Calendário, Banco de Dados, Global |
| Modo | Nova Aba \| Incorporado |
| Ordem | Número (padrão: 0) |
| Cor | Seletor de cor |
| Widget ativo | Toggle on/off |

---

## Administração → Configurações (`/settings`)

**Estado atual:** todos os itens configuráveis estão como "Desabilitado".

### Configurações Gerais
| Configuração | Opções | Estado atual |
|-------------|--------|-------------|
| Moeda | BRL (R$) | BRL |
| Tipo Agendamento | Desabilitado \| Por Fila \| Por Empresa | Desabilitado |
| Enviar Mensagens Horário Comercial | Desabilitado \| Habilitado | Desabilitado |

### Configurações de Atendimento
| Configuração | Estado atual |
|-------------|-------------|
| Enviar Saudação ao Aceitar | Desabilitado |
| Enviar Saudação na Transferência | Desabilitado |
| Sincronizar responsável da conversa com negócio | Desabilitado |

### Permissões e Segurança
| Configuração | Estado atual |
|-------------|-------------|
| Restringir visualização de histórico | Desabilitado |

---

## Menu do Usuário (canto superior direito)
- **Perfil** — configurações do perfil pessoal
- **Preferências** — preferências da plataforma
- **Sair** — logout

---

## Observações Estratégicas

1. **Todos os usuários pausados** — nenhum agente ativo no momento, sugerindo que o atendimento humano está inativo
2. **Cargos vazios** — nenhum cargo criado, as permissões granulares ainda não foram aplicadas
3. **Webhooks de saída** cobrem tanto eventos Comerciais quanto de Canal de atendimento — mais abrangentes que os webhooks documentados na API
4. **Widgets** podem exibir URLs externas incorporadas com contexto do usuário logado (útil para integrar ERP Educacional dentro do Nexvy)
5. **Assinatura ativa até 06/03/2027** — ~11 meses de runway garantido no plano Unlimited
6. **Canal padrão dos usuários** é WABA (+55 67 9 3618-0058) — confirma que este é o principal canal de atendimento da FIC
