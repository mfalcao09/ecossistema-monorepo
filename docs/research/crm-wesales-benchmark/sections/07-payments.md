# 07 — Payments

**URL:** `/payments/invoices`

## Subnav (enorme — e-commerce completo embutido)

### Invoices & Estimates (badge: **New**)
- `All Invoices` — `/payments/invoices`
- `Recurring Invoices` — `/payments/recurring-templates`
- `Templates` — `/payments/invoice-templates`
- `Estimates` (New) — `/payments/v2/estimates`

### Documents & Contracts
- `All Documents & Contracts` — `/payments/proposals-estimates`
- `Templates` — `/payments/proposals-estimates/templates`

### Commerce
- `Orders` — `/payments/v2/orders`
- `Abandoned Checkouts` (New) — `/payments/v2/abandoned-checkouts`
- `Subscriptions` — `/payments/v2/subscriptions`
- `Payment Links` — `/payments/v2/paymentlinks`
- `Transactions` — `/payments/v2/transactions`

### Products (New)
- `Products` — `/payments/products`
- `Collections` — `/payments/products/collections`
- `Inventory` — `/payments/products/inventory`
- `Reviews` (New) — `/payments/products/reviews`

### Outros
- `Coupons` — `/payments/coupons`
- `Gift Cards` (New) — `/payments/gift-cards`
- `Settings` — `/payments/settings/receipts`
- `Integrations` — `/payments/integrations`

## Features = **e-commerce completo**

- [x] Invoices (one-time + recurring) + templates
- [x] Estimates/Quotes
- [x] Proposals & Contracts (assinaturas? provável integração DocuSign-like)
- [x] Orders management
- [x] **Abandoned Checkouts** — recuperação de carrinho (trigger automático provável)
- [x] Subscriptions (SaaS-style billing)
- [x] Payment Links shareáveis
- [x] Transactions log
- [x] Products + Collections + **Inventory** (estoque)
- [x] Product Reviews
- [x] Coupons
- [x] Gift Cards
- [x] Integrations (Stripe, Paypal, NMI, Authorize.Net padrão GHL)

## Observação crítica pra benchmark

WeSales tem **módulo full e-commerce** rivalizando com Shopify Light. Isso é um diferencial massivo vs Pipedrive (que tem só marketplace integrations). Para Intentus imobiliário não é prioridade, mas pra FIC/Klésis (venda de cursos/produtos) é relevante.

## Comparação

| Feature | WeSales | Pipedrive | Stripe | Intentus |
|---------|---------|-----------|--------|----------|
| Invoices recorrentes | ✅ | ⚠️ addon | ✅ | ⚠️ (via Inter) |
| Abandoned checkouts | ✅ | ❌ | ❌ | ❌ |
| Products + Inventory | ✅ | ❌ | ⚠️ | ❌ |
| Gift cards | ✅ | ❌ | ❌ | ❌ |
| Coupons | ✅ | ❌ | ✅ | ❌ |
| Proposals/Contracts | ✅ | ⚠️ addon | ❌ | ⚠️ (via BRy) |
| Payment links | ✅ | ⚠️ | ✅ | ⚠️ |
