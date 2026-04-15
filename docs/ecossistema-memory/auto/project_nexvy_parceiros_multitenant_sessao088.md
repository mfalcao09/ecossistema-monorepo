---
name: Nexvy CRM — Painel de Parceiro / Multi-tenant (Sessão 088 Batch 10)
description: Documentação completa do Painel de Parceiro da Nexvy — sistema multi-tenant de revenda. AF EDUCACIONAL já é cliente da Nexvy (parceira ON AI SOLUTIONS LTDA). Cobre: Dashboard, Configurações, Webhooks de checkout, Clientes, Planos, Produtos e Personificação.
type: project
---

## DESCOBERTA CRÍTICA — Contexto do Painel

O Painel de Parceiro (`/partner-dashboard`) é acessado pela conta **Nexvy (avivacolonia@gmail.com)**, que pertence à empresa **ON AI SOLUTIONS LTDA** — a parceira revendedora da Nexvy que gerencia AF EDUCACIONAL como cliente.

**AF EDUCACIONAL já é cliente cadastrado** da parceira ON AI SOLUTIONS LTDA. Isso explica por que a conta da FIC existe dentro do ecossistema Nexvy com email `marcelo.falcao@afeducacional.com.br`.

---

## Dashboard do Parceiro (`/partner-dashboard`)

### Cabeçalho
| Campo | Valor |
|-------|-------|
| Título | **Nexvy** |
| Subtítulo | "Confira informações da sua operação" |
| Saldo disponível para saque | R$ •••••• (ocultado) |
| Botão | **Saque** |

### Licença de Revenda (card)
| Campo | Valor |
|-------|-------|
| Plano | 3 usuários • 1 canal |
| Periodicidade | Mensal |
| Valor | **R$ 57,00/mês** |
| Licenças grátis | 4/4 |
| Usuário extra | R$ 7,00 |
| Canal extra | R$ 17,00 |

### Clientes (card)
| Campo | Valor |
|-------|-------|
| Ativos | **2 ativos** |
| Recorrência média | **13 meses** |

### Primeiros Passos do Parceiro (Novo)
- 0/1 — 0%
- "Criar cliente via Carteira" — Pular | Iniciar
- "Criar cliente via Checkout" — **Em breve**

### Controle de Assinaturas (Abril 2026)
| Métrica | Valor |
|---------|-------|
| Total | R$ 0,00 (0 assinaturas) |
| Pago | R$ 0,00 (0 pagas) |
| Pendente | R$ 0,00 (0 pendentes) |
| Vencido | R$ 0,00 (0 vencidos) |
| Previsão | R$ 0,00 (0 futuras) |
| Checkout | R$ 0,00 (0 via checkout) |
| Manual | R$ 0,00 (0 manuais) |

Gráfico diário com legenda: Pago, Pendente, Vencido, Previsão.

### Análise de Recorrências (Abril 2026)
| Card | Valor |
|------|-------|
| Recorrências Pagas | R$ 0,00 (0 recorrências) |
| A Receber (Pendentes) | R$ 0,00 (0 renovações) |
| Inadimplentes (Vencidas) | R$ 0,00 (0 renovações) |
| Total Pendente | R$ 0,00 |
| Total do Mês | R$ 0,00 |

**Previsão de Receita — Próximos 12 Meses:** ABR/2026 a MAR/2027 — todos R$ 0,00 (0 recorrências)

### Extrato de Transações
- Período: 01/04/2026 - 13/04/2026
- Colunas: Data, Tipo, Cliente, Cliente (email), Plano, Sua Comissão, Valor Total
- Estado: vazio (0-0 de 0)

### Venda
- Colunas: Data, Método, Status, Produto, Valor Bruto, Valor Líquido, Comprador
- Estado: vazio

---

## Configurações do Parceiro (3 abas)

### Aba 1 — Informações Financeiras

**Dados da Empresa (Parceira)**
| Campo | Valor |
|-------|-------|
| Email | avivacolonia@gmail.com |
| Documento (CNPJ) | 49.895.999/0001-73 |
| Telefone | (41) 99283-8484 |
| Tipo | Pessoa Jurídica |
| Nome Fantasia | **ON AI SOLUTIONS LTDA** |
| Razão Social | ON AI SOLUTIONS LTDA |
| Receita Anual | R$ 100.000 |

**Representante Legal**
| Campo | Valor |
|-------|-------|
| Nome | Luciane Inacio Pompeu |
| Email | avivacolonia@gmail.com |
| CPF | 044.746.679-80 |
| Data de Nascimento | 13/10/1977 |
| Renda Mensal | R$ 5.000 |
| Ocupação | Empresária |

**Dados Bancários**
| Campo | Valor |
|-------|-------|
| Titular | ON AI SOLUTIONS LTDA |
| Tipo de Titular | Pessoa Jurídica |
| CNPJ | 49.895.999/0001-73 |
| Código do Banco | 323 |
| Agência | 0001 |
| Conta (sem dígito) | 5192312766 |
| Dígito | 1 |
| Tipo de conta | Conta Corrente |

**Endereço**
- Rua General Anor Pinho, 292 - B — Boa Vista, Curitiba - 82650-140 ✅ (selecionado)

### Aba 2 — Envio de emails
- Lista vazia
- Botão "+ Adicionar Email"
- **Modal Adicionar Email Host:** Host SMTP, Porta SMTP, User SMTP, Senha SMTP, Email de envio, Toggle "Email Padrão"

### Aba 3 — Webhooks (do Parceiro — distintos dos webhooks do CRM)
Finalidade: **Notificações de eventos de checkout** (vendas, pagamentos, assinaturas)

**Configurar Webhook:**
- Campo: URL do Webhook + Salvar

**4 eventos com exemplos de payload:**

#### ORDER_CREATED (Pedido Criado)
```json
{
  "event": "ORDER_CREATED",
  "data": {
    "amount": 199.9,
    "orderId": 12345,
    "buyer": "cliente@email.com",
    "product": "Plano Premium",
    "paymentMethod": "CREDIT_CARD",
    "recurrenceInterval": "MONTH",
    "recurrenceIntervalCount": 1,
    "recurrenceCounter": 0,
    "status": "PENDING",
    "nextPaymentDate": "2025-08-01T00:00:00.000Z"
  }
}
```

#### ORDER_PAID (Pedido Pago)
```json
{
  "event": "ORDER_PAID",
  "data": {
    "amount": 199.9,
    "orderId": 12345,
    "buyer": "cliente@email.com",
    "product": "Plano Premium",
    "paymentMethod": "CREDIT_CARD",
    "recurrenceInterval": "MONTH",
    "recurrenceIntervalCount": 1,
    "recurrenceCounter": 0,
    "status": "PAID",
    "paidAt": "2025-07-23T14:00:00.000Z"
  }
}
```

#### ORDER_RENEWED (Assinatura Renovada)
```json
{
  "event": "ORDER_RENEWED",
  "data": {
    "amount": 199.9,
    "orderId": 12345,
    "buyer": "cliente@email.com",
    "product": "Plano Premium",
    "paymentMethod": "CREDIT_CARD",
    "recurrenceInterval": "MONTH",
    "recurrenceIntervalCount": 1,
    "recurrenceCounter": 1,
    "status": "PAID",
    "paidAt": "2025-08-23T14:00:00.000Z",
    "nextPaymentDate": "2025-09-23T00:00:00.000Z",
    "orderExtras": [{ "id": 1, ... }]
  }
}
```

#### ORDER_PAYMENT_LATE (Pagamento Atrasado)
```json
{
  "event": "ORDER_PAYMENT_LATE",
  "data": {
    "amount": 199.9,
    "orderId": 12345,
    "buyer": "cliente@email.com",
    "product": "Plano Premium",
    "paymentMethod": "CREDIT_CARD",
    "recurrenceInterval": "MONTH",
    "recurrenceIntervalCount": 1,
    "recurrenceCounter": 2,
    "nextPaymentDate": "2025-10-23T00:00:00.000Z"
  }
}
```

**Logs do Webhook:**
- Busca por texto, filtro por Evento e Status
- Período: 01/04/2026 - 13/04/2026
- "Nenhum log encontrado"

---

## Clientes (`/companies`)

**Resumo:** 3 clientes (1-3 de 3) | Saldo: R$15.00 | 4 licenças anuais gratuitas para uso

| Nome da empresa | E-mail | Situação | Criada em |
|----------------|--------|----------|-----------|
| andersonkrasnuk@gmail.com | andersonkrasnuk@gmail.com | Ativa | 23/02/2026 |
| **AF EDUCACIONAL** | **marcelo.falcao@afeducacional.com.br** | **Ativa** | **04/02/2026** |
| Nexvy | avivacolonia@gmail.com | Ativa | 04/02/2026 |

> ⚠️ AF EDUCACIONAL está cadastrada como cliente da parceira desde 04/02/2026 com Plano licenças, pagamento único, ativo até 06/03/2027.

### Modal Adicionar Cliente
| Campo | Detalhe |
|-------|---------|
| Nome | Texto livre |
| E-mail | Obrigatório (*) |
| Telefone | Opcional |
| Status | ATIVA (padrão) |
| + Adicionar Assinatura | Associar plano na criação |

### Modal Adicionar Assinatura (dentro do cliente)
| Campo | Opções |
|-------|--------|
| Status | ATIVA |
| Plano | Dropdown dos planos |
| Recorrência | Dropdown |
| Data de Expiração | Auto calculada pela recorrência |
| Tipo de Cobrança | Pagamento Único |

---

## Planos (`/plans`)

6 planos disponíveis (1-6 de 6):

| Nome | Usuários | Canais | Filas | Ação |
|------|---------|--------|-------|------|
| Administrador Nexvy | 10 | 3 | 999 | 🔒 (imutável) |
| Plano Inter | 5 | 3 | 5 | Editar/Excluir |
| Plano ISENÇÃO | 5 | 3 | 3 | Editar/Excluir |
| Plano licenças | 3 | 1 | 99 | Editar/Excluir |
| Plano Lite | 3 | 1 | 2 | Editar/Excluir |
| Plano Pro | 10 | 3 | 5 | Editar/Excluir |

> AF EDUCACIONAL está no **Plano licenças** (3 usuários, 1 canal, 99 filas)

### Modal Adicionar Plano — Recursos (checkboxes)

| Recurso | Estado padrão |
|---------|--------------|
| Agendamentos | ✅ |
| Chat Interno | ✅ |
| API Externa | ✅ |
| Negócios | ✅ |
| Dashboard | ✅ |
| Ligações VOIP | ✅ |
| Integrações | ✅ |
| DS Voice | ✅ |
| DS Agente | ✅ |
| DS Bot | ✅ |
| Instagram | ✅ |
| DS Track | ✅ |
| Mostrar carteira no dashboard | ✅ |
| Webhooks | ✅ |
| Modelos de Mensagens | ☐ |
| Links de Redirecionamento | ☐ |
| Vídeos Explicativos | ✅ |

---

## Produtos (`/products`)

4 produtos com links de checkout públicos (1-4 de 4):

| Nome | Plano | Recorrência | Link de compra |
|------|-------|-------------|----------------|
| Plano ISENÇÃO | Plano ISENÇÃO | Mensal | https://console.nexvy.tech/checkout/plano-isencao |
| Plano Pro | Plano Pro | Mensal | https://console.nexvy.tech/checkout/plano-pro |
| Plano Inter | Plano Inter | Mensal | https://console.nexvy.tech/checkout/plano-inter |
| Plano Lite | Plano Lite | Mensal | https://console.nexvy.tech/checkout/plano-lite |

### Modal Adicionar Produto
| Campo | Detalhe |
|-------|---------|
| Nome | Texto livre |
| Selecionar plano | Todos os 6 planos disponíveis |
| Tipo de pagamento | Assinatura Recorrente \| Pagamento Único |
| Recorrência | Anual \| Semestral \| Trimestral \| Mensal |

---

## Biblioteca de Vídeos — Parceiros (`/explanatory-videos`)

- Estado: vazia — "Nenhum vídeo foi criado ainda"
- "Crie seu primeiro vídeo para começar a orientar os usuários"
- Botão "+ Novo Vídeo" + busca

---

## Menu do Usuário (Parceiro) — Opção Exclusiva

No Painel de Parceiro, o menu do usuário tem uma opção a mais que não existe no painel cliente:

- Perfil
- **Personificar empresa** ← EXCLUSIVO do parceiro
- Preferências
- Sair

### Modal Personificar Empresa
Permite ao parceiro logar como se fosse um dos seus clientes (impersonation/masquerade):

| Cliente disponível |
|--------------------|
| andersonkrasnuk@gmail.com |
| **AF EDUCACIONAL** — marcelo.falcao@afeducacional.com.br |
| Nexvy — avivacolonia@gmail.com |

---

## Observações Estratégicas

1. **AF EDUCACIONAL é cliente da ON AI SOLUTIONS** desde 04/02/2026 — plano licenças manual, pagamento único, ativo até 06/03/2027. Isso confirma a relação comercial existente.

2. **Webhooks do Parceiro são distintos dos webhooks do CRM** — os do parceiro cobrem ciclo de vida de pagamentos (ORDER_CREATED, ORDER_PAID, ORDER_RENEWED, ORDER_PAYMENT_LATE); os do CRM cobrem atendimento (COMMERCIAL_ORDER, Canal).

3. **Dois tipos de receita possíveis para o parceiro:**
   - Carteira: usar saldo (R$15.00 atual) para liberar licenças manualmente
   - Checkout: links públicos de compra (`/checkout/plano-xxx`) — **Em breve**

4. **Plano licenças** (o plano da AF EDUCACIONAL): 3 usuários, 1 canal, 99 filas — confirma que 4 usuários atuais usam as 4 licenças grátis incluídas (não são cobrados como extras).

5. **Personificação de empresa** é uma feature de suporte poderosa — permite que o parceiro (ON AI SOLUTIONS) acesse a conta da AF EDUCACIONAL para prestar suporte ou configurar.

6. **R$57,00/mês** é o custo mensal da licença de revenda da ON AI SOLUTIONS para a Nexvy (não é o que AF EDUCACIONAL paga).

7. **Não implementar agora** — documentado conforme instrução do Marcelo, mas o conhecimento da arquitetura multi-tenant pode ser valioso para futuros projetos de SaaS (ex: Intentus, Nexvy própria).
