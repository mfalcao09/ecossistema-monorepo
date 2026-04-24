# 07.x — Payments sub-pages (drill)

## Subnav completo confirmado (topbar Payments)

- Invoices & Estimates [New]
  - Invoices, Recurring Invoices, Templates, Estimates
- Documents & Contracts
  - All Documents & Contracts, Templates
- Orders
- Subscriptions
- Payment Links
- Transactions
- Products [New]
  - Products, Collections, Inventory, Reviews
- Coupons
- Gift Cards [New]
- Settings
- Integrations

---

## 07.1 — Estimates (`/payments/v2/estimates`)

### Dashboard cards (com métricas R$)
| Status | Contagem | Valor |
|--------|---------:|-------|
| Sent | 0 | R$0.00 |
| Accepted | 0 | R$0.00 |
| Declined | 0 | R$0.00 |
| **Invoiced** | 0 | R$0.00 |

### Tabs
All / Draft / (mais — provável: Sent, Accepted, Declined, Invoiced)

### CTAs
`Settings` + `+ New Estimate`

### Interpretação
Orçamentos/Propostas com workflow Draft → Sent → Accepted/Declined → **Invoiced** (conversão em fatura). Currency já em R$.

---

## 07.2 — Orders (`/payments/v2/orders`)

**Descrição:** "Track all order submissions in a single place"

### CTAs
`Import as CSV` + `Filters`

### Colunas
Customer / Source / **Items** / Order Date / Amount / Status

### Filtros
Start Date / End Date / Search / Filters (avançado)

### Interpretação
Log transacional de pedidos (funnel/store submissions). Source indica de onde veio (funnel X, form Y, store Z).

---

## 07.3 — Subscriptions (`/payments/v2/subscriptions`)

**Descrição:** "Keep track of customer subscriptions created via order forms"

### CTAs
`+ Add Subscription` + `Filters`

### Interpretação
Gestão de assinaturas SaaS-style: recurring billing, active/paused/canceled states, trial handling (provável). Subscriptions são criadas tipicamente via order forms (não pela UI diretamente).

---

## 07.4 — Products (`/payments/products`)

**Descrição:** "Create and Manage products for your business."

### CTAs
- `Import as CSV` (catálogo em massa)
- **`Import from Stripe`** ⭐ — integração nativa Stripe (importa products + prices)
- `+ Create Product`

### Colunas
Image / Product name / Product Type / Updated

### Interpretação crítica
**Import from Stripe** confirma Stripe como fonte canônica do catálogo. Products são replicados do Stripe para uso em checkouts WeSales. Multi-direção: WeSales é front-end de vendas, Stripe é backend de billing.

---

## 07.5 — Integrations ⭐⭐ (`/payments/integrations`)

**Descrição:** "Manage payment providers here"

### CTA principal
`Configure providers`

### Layout
2 seções: **Connected** (collapsible) + **More Providers**

### Providers disponíveis (visíveis no scroll)

| Provider | Região | Features destacadas |
|----------|--------|---------------------|
| **Stripe** | US / EU / APAC | Cards, wallets (Apple/Google Pay), bank debits, multi-currency |
| **PayPal** | Worldwide | PayPal balance, cards, Venmo, linked bank accounts |
| **Authorize.net** | US | (tradicional gateway US) |
| **Manual Payment Methods** | — | Cash on Delivery, custom offline |
| **Square** | US / CA / UK / AU | Simple card acceptance + POS + online |
| **Adyen** | EU / Middle East | Cards e métodos locais |
| **Mercado Pago** ⭐ | **LATAM: Argentina, Brasil, México, Colômbia, Chile, Peru, Uruguai** | Leading LATAM payment platform |

### ⚠️ AUSENTES (gap para BR enterprise)

Comparação com o mercado BR:
| Provider BR | WeSales suporta? |
|-------------|:---:|
| Mercado Pago | ✅ |
| Stripe | ✅ |
| PayPal | ✅ |
| **Cielo** | ❌ |
| **Rede** | ❌ |
| **Getnet** | ❌ |
| **Stone** | ❌ |
| **PagSeguro / PagBank** | ❌ |
| **Banco Inter (como adquirência)** | ❌ |
| **PIX direto (sem intermediário)** | ❌ (provável via Mercado Pago) |

### Implicação para Intentus

Pra operar **FIC/Klésis no Brasil** o stack recomendado deve suportar:
- **PIX nativo** (inevitável para SMB BR)
- **Boleto** (Banco Inter como stack atual — memory: `project_inter_sandbox`)
- **Cartão via adquirente local** (Stone/Rede/Cielo com taxas BR competitivas)

WeSales cobre isso **só via Mercado Pago** — limitado. Gap real pro mercado BR enterprise.

### CTA `Search For More`
Indica que há **mais providers além desses 7** — provável Klarna, Afterpay, Clover, iyzico, Checkout.com. Drill adicional em sessão futura.

---

## 07.6 — Settings (`/payments/settings/receipts`) *(não drilled nesta sessão)*

URL path sugere configs como:
- Receipts templates
- Invoice numbering
- Tax rates
- Currency config
- Auto-reminders
- Refund policy

---

## Gap summary Payments

| Feature | WeSales | Intentus hoje | Gap |
|---------|:---:|:---:|:---:|
| Multi-gateway integration | ✅ (7+ providers) | ⚠️ (só Inter) | ALTO |
| Mercado Pago BR | ✅ | ❌ | ALTO |
| PIX nativo | ⚠️ via MP | ⚠️ via Inter | — |
| Boleto BR | ❌ direto | ✅ via Inter | WeSales perde |
| Products + Inventory | ✅ | ❌ | MÉDIO |
| Subscriptions | ✅ | ❌ | MÉDIO |
| Estimates→Invoice | ✅ | ❌ | MÉDIO |
| Abandoned checkout | ✅ | ❌ | BAIXO |
| Gift cards + Coupons | ✅ | ❌ | BAIXO |
