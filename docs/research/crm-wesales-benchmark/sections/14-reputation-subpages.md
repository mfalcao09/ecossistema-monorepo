# 14.x — Reputation sub-pages (drill)

## 14.1 — Requests (`/reputation/requests`)

**Headline:** "Requests"
**CTAs:** `Configure Review Link` + `Send Review Request`
**Filtros:** Search by name/email/phone / **Status** / **Sent via** (canal)
**Empty state:** "Start Sending Review Requests / Send your first review request to start building credibility and attracting more customers."

### Interpretação
Log + initiator de pedidos de review. `Sent via` permite filtrar por SMS/email/WhatsApp/link compartilhado.

---

## 14.2 — Reviews ⭐ (`/reputation/reviews`)

### Tabs especiais
- **AI Summary** ⭐ — AI resumindo sentimento + temas + NPS inferido
- (lista de reviews)

### Filtros
- Ratings (1-5★)
- Sources (Google/Facebook/Yelp/TripAdvisor)
- Start Date / End Date
- Search

### CTAs
- `Add Reviews` (manual entry)
- `Send Review Request`

### Interpretação crítica
**AI Summary** é a sentiment analysis agregada dos reviews — extrai temas recorrentes ("atendimento lento", "preço justo", "localização ótima") e gera insights acionáveis.

Gap para FIC/Klésis/Intentus: não existe feature similar no ecossistema hoje. Reviews são gerenciados manualmente via Google My Business / Facebook Business Suite.

---

## 14.3 — Video Testimonials ⭐ (`/reputation/video-testimonials`)

### Tabs
Overview / **Video Collectors** / **Responses**

### Onboarding 0/4
Hi MARCELO / Get Started (0/4):
1. Create a Video Collector
2. Send a Review Request
3. Collect a Video Testimonial
4. Create a Video Widget

### CTAs
`Send Review Request` / `Create Collector`

### Interpretação
**Video Collectors** são landing pages/widgets onde cliente grava vídeo testimonial direto do browser (webcam-based capture). Mais forte que review textual — vídeo = prova social premium.

Padrão similar ao **Testimonial.to** ou **VideoAsk** embutido no CRM.

---

## 14.4 — Widgets (`/reputation/widget`)

Não drilled. Provável: widget embeddable (JS snippet) pra mostrar reviews no site externo, similar ao Trustpilot widget.

---

## 14.5 — Listings ⭐⭐ (`/reputation/listing`)

### Headline
"One Tool to List / Don't leave your online reputation to chance harness the potential of Listings today !!"

### Feature set (paid addon)
- **Listing Management** — aparecer em 50-100+ diretórios globais
- **Premium Backlinks** — SEO boost por backlinks de autoridade
- **Sync Functionality** — 1 update propaga pra todos diretórios
- **Duplicate Suppression** — remove entries duplicados de diretórios

### CTAs
- `Scan my business for FREE!` — free audit do estado atual das listagens
- `Activate Listings` — upgrade ao addon pago

### Interpretação
Integração com **Yext-style listing management** (Yext, Moz Local, BrightLocal pattern). Paid subscription separada. Gap enorme pra SMB brasileiro que quer aparecer em Google Maps / Apple Maps / Reclame Aqui / TripAdvisor sem contratar agência.

---

## 14.6 — Settings (`/reputation/settings`)

Não drilled. Provável: default review request template, sender config, rating threshold pra auto-publish (ex: 5★ auto-publish, 1-3★ route para equipe resolver antes), branding customização.

---

## Gap summary Reputation

| Feature | WeSales | Intentus/FIC |
|---------|:---:|:---:|
| Multi-source review aggregation | ✅ | ❌ |
| **AI Summary de reviews** ⭐ | ✅ | ❌ |
| Review requests automation | ✅ | ❌ |
| **Video Testimonials (webcam)** | ✅ | ❌ |
| Widgets embeddable | ✅ | ❌ |
| Listings management (50+ dirs) | ✅ (paid) | ❌ |
| Duplicate suppression | ✅ | ❌ |
| Free scan audit | ✅ | ❌ |

Para **Klésis (escola B2C)** e **FIC (ensino superior)** a feature é **crítica** — pais escolhem escola pesquisando reviews. Hoje Klésis/FIC dependem 100% do Google My Business manual.
