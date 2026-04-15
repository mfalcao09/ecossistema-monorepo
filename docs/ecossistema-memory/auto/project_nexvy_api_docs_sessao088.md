---
name: Nexvy CRM — Documentação Completa da API REST (Sessão 088 Batch 8)
description: API REST da Nexvy v1.0.0 — endpoints de Mensagens, Dashboard, CRM (Contatos/Tickets/Negócios) e Webhooks com payloads completos
type: reference
---

## Informações Gerais

| Campo | Valor |
|-------|-------|
| Versão | 1.0.0 |
| Base URL | `https://core.nexvy.tech/api` (NÃO a console URL!) |
| Console URL | `https://console.nexvy.tech` |
| Autenticação | Header `api-key` em TODOS os endpoints |
| Status da chave | ⚠️ "Nenhuma chave gerada" — precisa gerar primeiro |

**Para gerar a api-key:** Acessar a documentação da API e clicar no ícone de chave 🔑 ao lado do campo.

---

## Seção 1 — MENSAGENS (`/messages-api`)

### 1.1 Envio de Mensagem de Texto
- **POST** `https://core.nexvy.tech/api/messages/send/v2`
- **Headers obrigatórios:**
  - `api-key` — Chave de autenticação da empresa
  - `Connection-Token` — Token da conexão responsável pelo envio
- **Body:**
  - `number` (string, required) — Ex: `5551998917243`
  - `body` (string, required) — Ex: `Olá, tudo bem?`
- **Responses:** 200 OK | 400 Erro | 401 Sem autenticação

### 1.2 Envio de Mensagem com Mídia
- **POST** `https://core.nexvy.tech/api/messages/send/v2`
- **Headers obrigatórios:** `api-key` + `Connection-Token`
- **Body (multipart/formData):**
  - `number` (string, required) — Ex: `5551998917243`
  - `medias` (array, required) — Arquivos binários (imagem, vídeo, áudio, documento)
  - Formato: `formData: { number: '5199999-9999', medias: [file1, file2] }`
- **Responses:** 200 OK | 400 Erro | 401 Sem autenticação

### 1.3 Envio de Template de Mensagem
- **POST** `https://core.nexvy.tech/api/message-template/send/v2`
- **Headers obrigatórios:** `api-key` + `Connection-Token`
- **Body:**
  - `number` (string, required) — Número do destinatário — Ex: `5551999999999`
  - `templateName` (string, required) — Nome do template cadastrado — Ex: `nome_do_template`
  - `processedText` (string, required) — Texto com placeholders `{{1}}`, `{{2}}` — Ex: `Olá {{1}}, tudo bem?\n\nVocê tem interesse em conhecer nosso novo produto?`
  - `manualVariables` (object) — Mapa de variáveis: `{ "{{1}}": "João Silva" }` — substitui no processedText

---

## Seção 2 — DASHBOARD

**Padrão:** Todos são GET, autenticação apenas com `api-key`, query params `date_from` e `date_to` (formato `d/m/Y`, ambos obrigatórios).

| Endpoint | URL | Descrição |
|----------|-----|-----------|
| Contadores do Dashboard | GET `/dashboard/counters` | Contadores gerais: contatos, tickets, negócios, etc. |
| Métricas de Chamadas | GET `/dashboard/calls` | Métricas de chamadas agrupadas por data |
| Métricas de Tags | GET `/dashboard/tags` | Distribuição de tags configuradas (DashboardSettingTags) |
| Métricas de Atividades | GET `/dashboard/activities` | Tarefas, follow-ups, reuniões dos leads por data |
| Métricas de Conversas | GET `/dashboard/chats` | Métricas de conversas por período |
| Relatório de Pré-venda | GET `/dashboard/presale` | Métricas da equipe de pré-venda (SDR) por data |
| Relatório de Closer | GET `/dashboard/closer` | Métricas da equipe de fechamento por data |
| Ranking de Pré-venda | GET `/dashboard/list/presale` | Ranking individual SDR por período |
| Ranking de Closers | GET `/dashboard/list/closer` | Ranking individual closers por período |
| Ranking de Produtos | GET `/dashboard/list/products` | Ranking dos produtos mais vendidos por período |

**Responses padrão:** 200 (dados) | 400 Parâmetros inválidos | 401 Falta de autenticação

---

## Seção 3 — CRM

### 3.1 Contatos (Leads)

#### Criação de Contato (Lead)
- **POST** `/contact`
- **Body:**
  - `number` (string, required) — Ex: `5551998917243`
  - `name` (string) — Ex: `João da Silva`
  - `tags` (array) — Ex: `["Quente", "Frio"]`
  - `customFields` (object) — Ex: `{ "cidade": "Novo Hamburgo", "estado": "RS", "faturamento": "1000" }`

#### Consulta de Contatos
- **GET** `/contact`
- **Query Params:** `id` (string), `number` (string), `page` (integer), `limit` (integer)
- **Responses:** 200 Lista | 400 | 401 | 404 (quando ID específico não encontrado)

#### Atualização de Contato
- **PUT** `/contact/{identifier}`
- **Path:** `identifier` — ID ou número do telefone
- **Body:**
  - `name` (string) — Ex: `João da Silva Atualizado`
  - `tags` (array) — Ex: `["VIP", "Cliente Especial"]`
  - `customFields` (object) — Ex: `{ "empresa": "Empresa XYZ", "cargo": "Gerente" }`

---

### 3.2 Tickets (Conversa)

#### Criação de Ticket (Conversa)
- **POST** `/ticket`
- **Body:**
  - `contact` (string, required) — Número ou ID do contato — Ex: `5551998917243`
  - `socialConnection` (string, required) — Nome ou ID da conexão — Ex: `WhatsApp Principal`
  - `queue` (string) — Nome ou ID da fila — Ex: `Suporte`
  - `responsible` (string) — Email ou ID do usuário — Ex: `atendente@empresa.com`

#### Consulta de Tickets (Conversa)
- **GET** `/ticket`
- **Query Params:** `uuid`, `number`, `page`, `startDate`, `endDate`, `limit`
- **Responses:** 200 Lista de tickets | 400 | 401

#### Atualização de Ticket (Conversa)
- **PUT** `/ticket/{identifier}`
- **Path:** `identifier` — ID, UUID ou número do telefone
- **Body:**
  - `status` (string) — Allowed: `pending` | `open` | `closed`
  - `queue` (string) — Nome da fila
  - `responsible` (string) — Email ou ID do usuário

#### Histórico de Mensagens
- **GET** `/ticket/{identifier}/messages`
- **Path:** `identifier` — UUID ou ID do ticket
- **Query Params:** `page`, `startDate`, `endDate`, `limit`
- **Responses:** 200 Histórico de mensagens | 400 | 401

---

### 3.3 Negócios Comerciais (Pipeline)

#### Consulta de Negócios (Pedidos Comerciais)
- **GET** `/commercial-order`
- **Query Params:** `id`, `number`, `page`, `limit`
- **Responses:** 200 Lista | 400 | 401 | 404

#### Atualização de Negócio (Pedido Comercial)
- **PUT** `/commercial-order/{identifier}`
- **Path:** `identifier` — ID do negócio ou número do telefone
- **Body:**
  - `step` (string) — Nome da etapa do funil — Ex: `Proposta`
  - `amount` (number) — Valor do negócio — Ex: `2500`
  - `responsible` (string) — Email do responsável — Ex: `vendedor@empresa.com`

---

## Seção 4 — WEBHOOKS

**Configuração:** URL de endpoint própria que aceita POST com os payloads abaixo.

### Eventos disponíveis

| Evento | Descrição |
|--------|-----------|
| `COMMERCIAL_ORDER_CREATED` | Novo negócio criado em uma coluna da pipeline |
| `COMMERCIAL_ORDER_STEP_CHANGED` | Negócio movido de coluna na pipeline |
| `COMMERCIAL_ORDER_CHANGED` | Qualquer campo do negócio atualizado na pipeline |

### Payload — COMMERCIAL_ORDER_CREATED
```json
{
  "event": "COMMERCIAL_ORDER_CREATED",
  "data": {
    "createdAt": "2025-07-23T19:30:58.219Z",
    "commercialOrderId": 1,
    "number": "55549999999",
    "name": "João",
    "stepId": 1,
    "step": "Nome da coluna",
    "pipelineId": 1,
    "pipeline": "Nome da Pipeline",
    "amount": "50.00",
    "userId": 1,
    "tags": [],
    "responsible": "teste@teste.com",
    "contact": { "id": 1, "name": "João", "number": "554999999999", "email": "joao@email.com" }
  }
}
```

### Payload — COMMERCIAL_ORDER_STEP_CHANGED
```json
{
  "event": "COMMERCIAL_ORDER_STEP_CHANGED",
  "data": {
    "transferAt": "2025-07-23T19:22:02.975Z",
    "commercialOrderId": 1,
    "oldStep": "Coluna Antiga",
    "oldStepId": 1,
    "toStep": "Nova Coluna",
    "toStepId": 2,
    "responsible": "teste@teste.com",
    "contact": { "id": 1, "name": "João", "number": "554999999999", "email": "joao@email.com" }
  }
}
```

### Payload — COMMERCIAL_ORDER_CHANGED (campos completos)
```json
{
  "event": "COMMERCIAL_ORDER_CHANGED",
  "data": {
    "id": 1, "amount": 1500, "status": "OPEN",
    "createdAt": "...", "updatedAt": "...",
    "meetingCreatedAt": null, "meetingRealizedAt": null,
    "wonAt": null, "lostAt": null, "lostReason": null,
    "lastTimeMoved": "...", "countedReceivedMessages": 5,
    "commercialProductId": 10, "companyId": 1,
    "userId": 2, "salesmanUserId": 3,
    "contactId": 100, "commercialSalesStepId": 5,
    "contact": {...}, "commercialSalesStep": {...},
    "user": {...}, "commercialProduct": {...}
  }
}
```

### Campos do Payload por evento

**COMMERCIAL_ORDER_STEP_CHANGED** (todos obrigatórios):
`transferAt`, `commercialOrderId`, `oldStep`, `oldStepId`, `toStep`, `toStepId`, `responsible`, `contact`

**COMMERCIAL_ORDER_CHANGED:**
Obrigatórios: `id`, `status`, `createdAt`, `updatedAt`, `companyId`, `contactId`
Opcionais: `amount`, `meetingCreatedAt`, `meetingRealizedAt`, `wonAt`, `lostAt`, `lostReason`, `lastTimeMoved`, `countedReceivedMessages`, `commercialProductId`, `userId`, `salesmanUserId`, `commercialSalesStepId`, `contact`, `commercialSalesStep`, `user`, `commercialProduct`

---

## Observações Críticas para Integração com n8n

1. **api-key NÃO está gerada ainda** — precisa gerar no painel da API antes de usar
2. **Connection-Token** é distinto da api-key — identifica QUAL canal envia a mensagem (WABA, Instagram etc.)
3. **Base URL é `core.nexvy.tech/api`**, não `console.nexvy.tech`
4. **Dashboard exige datas** no formato `d/m/Y` (ex: `13/4/2026`)
5. **Webhooks só cobrem eventos de CRM/Pipeline** — sem eventos para mensagens ou tickets
6. **customFields** é flexível (qualquer chave/valor) — permite extensão sem mudança de API
7. **identifier no PUT** aceita tanto ID numérico quanto número de telefone — facilita automação
