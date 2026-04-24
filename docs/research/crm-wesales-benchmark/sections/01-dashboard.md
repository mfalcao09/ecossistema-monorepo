# 02 — Dashboard

**URL:** `/v2/location/Y7zRiUzHgMiV4SsmLhJK/dashboard`
**Capturado:** 2026-04-21 16:06

## Screenshot
Capturado inline no chat (viewport 1568x782 @ dpr 2). Chrome MCP não persiste em disco.

## Componentes detectados

### Layout principal
- **Sidebar esquerda** (collapsable via botão "Collapse sidebar") com 17 items top-level
- **Topbar persistente** com logo + Search + botões de ação
- **Main content** com widgets

### Topbar (elementos interativos)
- **Suporte** — botão verde-lime com ícone `!` (acesso a help/chat)
- **Webphones** — botão roxo com ícone headset + dot vermelho (status de conexão telefônica)
- **Voice Calling** — trigger de chamada
- **Open Dashboard Selector** — dashboard é configurável/multi-dashboard
- **Last 30 Days** — date range picker global
- **Previous / Next** — navegação de ciclo de datas
- **Search** (`⌘K`) — search global de contatos/ações/etc

### Phone Dialer (widget embutido)
Detectado DOM do dialpad: dígitos `1-9`, `0`, `*`, `#` e CTA "Buy phone number" + "Connect a phone number".
**Implicação:** WeSales tem dialer nativo no app para fazer chamadas direto do navegador (feature de CRM + voice integrada).

### Account/User picker
- Top sidebar: "SELECTED User not assigned" — indica UI de atribuição de responsável
- Multi-account: dropdown "MARCELO S B FALC... / São Paulo, SP" confirma **multi-tenant**

## Widgets do Dashboard (vistos na captura)

1. **Opportunity Status** — gráfico por status de oportunidade (filtro: All Pipelines)
2. **Opportunity Value** (header truncado) — valor monetário (filtro: All Pipelines)
3. **Conversion Rate** — donut chart com % + "Won revenue R$0"
4. **Funnel** — visualização de funil (filtro: pipeline selecionável)
5. **Stage Distribution** — distribuição por stage (filtro: pipeline)

**Estado capturado:** 0 dados em todos os widgets (conta nova/vazia) — bom porque mostra **empty states** do sistema:
- Ícone de lupa com "No Data Found"
- Donut em 0% com "Won revenue R$0"

## Features de dashboard observadas

- [x] Multi-dashboard (Dashboard Selector)
- [x] Filtro global de pipeline por widget
- [x] Date range picker com nav previous/next
- [x] Empty states bem definidos (lupa + msg)
- [x] Widgets focados em **Opportunities/Vendas** (não Conversations/Marketing no default)
- [ ] Drag-and-drop de widgets — não confirmado ainda
- [ ] Widgets customizados — "Collapse sidebar" indica customização de layout

## Internacionalização

Labels mistos:
- **EN:** "Dashboard", "Opportunity Status", "All Pipelines", "No Data Found", "Won revenue", "Last 30 Days"
- **PT-BR:** "Suporte", "Central de Aceleração W..."

## Menu "⋮" (three dots)

Presente no canto superior direito do dashboard — provável: save/export/configure dashboard.

## Observações p/ benchmark

- Default dashboard é **vendas-centric** (pipeline/oportunidades/receita), não atendimento
- Formatação monetária: **R$** (BRL) — confirma localização BR
- Widgets com empty states bem cuidados (lupa + msg)
- Presença de phone dialer integrado diferencia de CRMs sem telefonia (Pipedrive nativo não tem)

## Comparação rápida

| Feature | WeSales | Pipedrive | Intentus (atual) |
|---------|---------|-----------|-------------------|
| Multi-dashboard | ✅ | ✅ (Insights) | ❌ |
| Phone dialer nativo | ✅ | ⚠️ integração | ❌ |
| Filtro global de pipeline | ✅ | ✅ | ⚠️ |
| Empty states | ✅ cuidados | ✅ | ⚠️ |
