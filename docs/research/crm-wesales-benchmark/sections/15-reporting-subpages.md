# 15.x — Reporting sub-pages (drill)

## 15.1 — Google Ads Report (`/reporting/google-ads`)

### Setup
"You're viewing sample data. Click Here to integrate your **Google account** and select the **Google Ads client ID** for which you want to see the data."

### Date range presets
This week / Last week / Last 7 days / Last 30 days / This month / Last month / This year / Last year + custom (month + year picker PT-BR "abril 2026")

### Columns
Configurable (via `Columns` button)

### Sample metric visível
Impressions: 175.235 (timeline Jan 2021 → Set 2026 — período longo pra tendências)

---

## 15.2 — Facebook Ads Report (`/reporting/facebook-ads`)

Pattern idêntico ao Google Ads (não drilled separado por similaridade).

---

## 15.3 — Attribution Report ⭐ (`/reporting/attribution`)

### Modelos de atribuição (tabs)
- **First Attribution** — creditar primeira touch
- **Last Attribution** — creditar última touch

*(não aparece Linear/Time Decay/Position-based no visible tab, mas podem existir em filters)*

### KPI cards
| Métrica | Valor default |
|---------|:---:|
| Revenue Closed | $0.00 |
| Won | 0 |
| Total Leads | 0 |

### Views (tabs)
Revenue / Leads / Opportunities — escolher dimensão do gráfico

### Session Events table
Colunas: Event Type, **Source, Contact, Campaign, UTM Medium, UTM Content, UTM Source, UTM Term**, Referrer, URL Link, Created At

**Full UTM tracking** — atribuição baseada em UTM parameters + session events. Padrão Google Analytics style.

### CTAs
Columns / Export / Filters

---

## 15.4 — Call Report (`/reporting/call`)

### Filtros
- All numbers (phone number filter)
- Incoming / Outgoing (direction)

### Métricas
- **Avg. call duration** / **Total call duration**
- **Call by Status** (chart)
- **First-time calls by status** (separate view)
- **Top Call Sources** (rankeado)

### Tabela
Source, Total Calls, Won Deals, Avg Duration

### Interpretação
Permite atribuir **revenue (Won Deals) por canal de call** — identificar qual phone number gera mais conversão.

---

## 15.5 — Agent Report ⭐ (`/reporting/agent`)

### Filtros
- User selector (multi-select: Select All / Deselect All)
- Date range (presets + custom)
- `Compare` toggle — comparar períodos
- `Fetch` — load data

### Métricas por agent
**Opportunities**: Total Leads / Open / Won / Abandoned / Lost (com contagem + %)
**Conversions** (breakdown)
**SMS**: Sent / Delivered / Click... (mais inferidos: Replied, Failed)

*(mais stats de Email, Call, Appointment inferidos abaixo do fold)*

### Interpretação
Produtividade por rep / SDR. Compare mode permite benchmark mês-a-mês. Essencial pra gestão de time comercial.

---

## 15.6 — Appointment Report ⭐ (`/reporting/appointment`)

### Filtros
- All Calendars / filter por calendar específico
- Date Added

### Status breakdown (cards)
Booked / Confirmed / Cancelled / New / **Showed** / **No Show** / Invalid / Rescheduled

### Dimensões (charts)
- **Channel** (SMS/email/direct/referral)
- **Source** (funnel X / form Y)
- **Funnel** specific
- **Outcomes** (closed/open)

### Rankings
- **Top 5 Most Booked Calendars**
- **Top 5 Appointment Owners**

### No-show rate
Métrica crítica pra service businesses (clínicas, estética) — cross-ref AI Agents landing que alegava "$200k rescued in no-show revenue".

---

## 15.7 — Local Marketing Audit (`/reporting/local-marketing-audit`)

Não drilled completo (page empty sem setup). Provável: auditoria SEO local (GBP score, directory listings match, citações, reviews count, competitors analysis).

---

## 15.8 — Custom Reports (`/reporting/reports`)

Já coberto em sessão 1 (seção 15-reporting.md).

---

## Gap summary Reporting

| Feature | WeSales | Intentus atnd-s7 hoje |
|---------|:---:|:---:|
| Custom report builder | ✅ | ❌ |
| Google Ads native integration | ✅ | ❌ |
| Facebook Ads native integration | ✅ | ❌ |
| **First/Last-touch Attribution** | ✅ | ❌ |
| **Full UTM tracking** | ✅ | ❌ |
| Call Report (revenue per channel) | ✅ | ❌ |
| **Agent/Rep productivity Report** | ✅ | ⚠️ (básico) |
| Compare periods | ✅ | ❌ |
| **Appointment Report (Show/NoShow)** | ✅ | ❌ |
| Local SEO Audit | ✅ | ❌ |

## Ecosystem insight

Reporting do WeSales é **ads-forward** — foco em ROAS e atribuição de revenue até mídia paga. Intentus ainda é **operational** (ops metrics, não marketing ROI). Gap significativo pra adoção enterprise.
