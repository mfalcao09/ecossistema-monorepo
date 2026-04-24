# Gaps Intentus vs WeSales — priorização por impacto

**Objetivo:** transformar observações do benchmark em **roadmap acionável** para o ecossistema Marcelo (Intentus + ERP-Educacional + Jarvis + future bets).

**Premissa:** Intentus NÃO precisa copiar tudo do WeSales. O benchmark revela **padrões comprovados** pro mercado BR SMB. Priorizar pelo **tripé de decisão Marcelo**: Viabilidade Financeira + Impacto Social + Coerência com Propósito (BAM).

---

## 🆕 Updates da sessão 2 de drill (revisão de prioridades)

Os drills profundos revelaram **3 features críticas** que reconfiguram a priorização original:

### Atualização #1 — AI prompt-to-workflow (BETA no WeSales)
Score ICE revisado: **Impact 10 × Confidence 8 × Ease 5 = 400** (era 243)
- Impact subiu: diferencial competitivo massivo (Pipedrive/HubSpot BR não têm)
- Ease subiu: Claude/GPT podem gerar JSON de workflow a partir de prompt controlado

### Atualização #2 — WhatsApp dual stack validado comercialmente
WeSales paywall $11/mo valida que **WhatsApp oficial É monetizável**. Jarvis/Intentus podem posicionar:
- Baileys grátis = aquisição (como WeSales "não oficial")
- WABA oficial = R$19-49/mo addon (benchmark: 3× WeSales pela sofisticação BR + suporte PT-BR)

### Atualização #3 — Agent Templates marketplace = revenue channel possível
Clara com 78K installs Paid = revenue share significativo. Se Intentus/FIC/Klésis desenvolverem agent vertical (ex: "Imobiliário Corretor IA", "Secretaria Educacional IA"), podem:
1. Publicar no marketplace GHL/WeSales (revenue share) — de consumidor vira produtor
2. Construir marketplace próprio no Intentus (long-term play)

### Atualização #4 — Gestleads como concorrente local visível
Agora sei que existe um player BR operando whitelabel GHL agressivamente. Pra mapear: quais verticais eles atacam, pricing, cases públicos. Marcelo pode:
- Pedir demo pra benchmark
- Entender oferta comercial
- Posicionar Intentus complementar ou competidor

## Matriz de priorização (ICE: Impact × Confidence × Ease)

| # | Gap | Impact | Confidence | Ease | Score | Onde entra |
|---|-----|:-:|:-:|:-:|:-:|-----------|
| 0 | **AI prompt-to-workflow** (natural language → JSON workflow, tipo WeSales BETA) | 10 | 8 | 5 | **400** ⭐⭐ | atnd-s8a v2 — big bet BR |
| 1 | **Visual workflow builder** (substituir IF/THEN motor atnd-s8a por no-code real) | 9 | 9 | 3 | **243** | atnd-s8a v2 |
| 2 | **Custom Values globais** (`{{company.x}}`, `{{campaign.y}}`) em templates | 8 | 9 | 8 | **576** | atnd-s5 |
| 3 | **Right-rail contextual** na conversa (9 slots: Contact/Workflow/Tasks/Notes/Calendar/Payments/...) | 9 | 9 | 6 | **486** | atnd-s8b |
| 4 | **Lead Scoring nativo** (+10 abriu email, +20 clicou CTA, etc) | 7 | 8 | 5 | **280** | atnd-s4 |
| 5 | **Manual Actions queue** (fila SDR para ações manuais programadas) | 8 | 8 | 5 | **320** | atnd-s4 |
| 6 | **Trigger Links** rastreáveis (UTM + automação ao click) | 8 | 9 | 7 | **504** | atnd-s5 |
| 7 | **Snippets / templates rápidos** (atalhos de texto em conversations) | 7 | 9 | 9 | **567** | atnd-s5 |
| 8 | **Team Inbox + My Inbox** separados | 9 | 10 | 6 | **540** | atnd-s8 |
| 9 | **WhatsApp dual stack** (WABA + Baileys com fallback) | 10 | 10 | 5 | **500** | jarvis-gateway (em curso) |
| 10 | **Custom Objects** (além de Contact/Company/Deal) — ex: Imóvel, Aluno, Turma | 10 | 7 | 3 | **210** | Platform roadmap longo |
| 11 | **Voice AI agent** (receptionista 24/7 telefone) | 9 | 7 | 2 | **126** | Jarvis V3 |
| 12 | **Conversation AI** (chatbot WhatsApp com handoff) | 10 | 9 | 5 | **450** | Jarvis V2 |
| 13 | **Knowledge Base / RAG** no CRM | 8 | 8 | 4 | **256** | Jarvis |
| 14 | **Agent Logs / Agent Reports** | 7 | 9 | 7 | **441** | Jarvis observability |
| 15 | **Social planner** (FB/IG/LI/TikTok agendamento) | 6 | 7 | 3 | **126** | Fora do escopo Intentus |
| 16 | **Branded Mobile App** (app whitelabel pro cliente final) | 8 | 6 | 2 | **96** | FIC/Klésis roadmap 2027 |
| 17 | **LMS + Community + Certificates** em uma plataforma | 9 | 8 | 3 | **216** | ERP-Educacional v2 |
| 18 | **Payment Links + Invoices recurring** no CRM | 7 | 8 | 6 | **336** | Cross com billing Inter |
| 19 | **Abandoned Checkout recovery** | 7 | 7 | 5 | **245** | Intentus e-com (se entrar) |
| 20 | **Reputation / Review Requests automatizados** | 6 | 8 | 6 | **288** | B2C verticals (clínicas/saúde se entrar) |

---

## Quick wins (Ease ≥ 7, Impact ≥ 7)

### W1. Custom Values globais (score 576)
**Implementação:** tabela `custom_values` escopada por tenant, resolver `{{keys}}` em templates de email/SMS/WA.
**Esforço:** 1 sprint (8h dev + 4h UI).
**Onde:** Integrar com atnd-s5 (Templates).

### W2. Snippets em conversations (score 567)
**Implementação:** atalhos `/saudacao`, `/assinatura`, `/agenda` que expandem texto ao enviar.
**Esforço:** 1 sprint.
**Onde:** `atnd-s5` já prevê — validar escopo.

### W3. Team Inbox vs My Inbox (score 540)
**Implementação:** flag `inbox_type` em conversations + policies de visualização.
**Esforço:** 1-2 sprints.
**Onde:** atnd-s8b (chat interno já separa, replicar lógica).

### W4. Trigger Links (score 504)
**Implementação:** serviço de short-link com UTM + redirect + webhook `link_clicked` que dispara workflow.
**Esforço:** 2 sprints (service + UI + integração atnd-s8a).
**Onde:** Novo serviço em `apps/link-tracker` ou embedded em atnd-s5.

### W5. Right-rail contextual (score 486)
**Implementação:** painel lateral em conversation detail com 6-9 tabs (Contact, Tasks, Notes, Calendar, Payments, Workflow).
**Esforço:** 2 sprints UI.
**Onde:** atnd-s8b já tem skeleton.

---

## Big bets (Impact ≥ 9, Confidence ≥ 8)

### B1. WhatsApp dual stack (score 500)
**Status:** em curso via `apps/whatsapp-gateway` (Baileys) + WABA Meta Cloud API.
**Confirmação do benchmark:** WeSales EXPÕE publicamente "WhatsApp Api Não Oficial" → valida demanda BR.
**Ação:** Acelerar F1-S03 e unificar roteamento em `@ecossistema/whatsapp-router`.

### B2. Conversation AI com handoff (score 450)
**Status:** conversa com IA direta ainda não existe em produção (Jarvis V1 é só ferramenta pessoal).
**Ação:** Jarvis V2 — AI agent conectado ao WhatsApp de clientes (FIC/Klésis/Intentus) que:
1. Responde 1º contato (FAQ, agendamento)
2. Qualifica lead
3. Handoff pra humano quando complexidade > threshold
**Prioridade:** Alta — WeSales roda isso como core value prop.

### B3. LMS + Certificates + Community para FIC/Klésis (score 216 mas impact 9)
**Status:** ERP-Educacional tem básico; Diploma Digital (BRy) em piloto.
**Ação:** expandir ERP-Educacional v2 com:
- Client Portal aluno (app + web)
- Courses module com lessons
- Certificates auto-gerados (reuse BRy pipeline já pronto)
- Community groups (por turma/disciplina)

---

## Skips explícitos (não implementar)

| Feature WeSales | Por que skipar |
|-----------------|----------------|
| Affiliate Manager full | Modelos de negócio Intentus/FIC/Klésis não têm programa de afiliados ativo |
| Ad Manager embutido | Google/Meta Ads geridos externamente por parceiros ou agências |
| Gokollab Marketplace | Não faz sentido ter marketplace interno pros cursos FIC/Klésis — eles são os cursos |
| 1306 apps marketplace | Intentus focado não precisa marketplace gigante; escolher 5-10 integrações certas |
| Brand Boards multi-brand | Ecossistema Marcelo já é multi-brand (Klésis+FIC+Splendori+Intentus+Nexvy); resolver em tenancy, não em brand kit |
| Webinars pages | Uso incidental; usar YouTube Live ou StreamYard não justifica feature própria |

---

## Roadmap sintético sugerido

### Q2 2026 (jun-ago)
- [ ] W1 Custom Values globais
- [ ] W2 Snippets (atnd-s5)
- [ ] W3 Team vs My Inbox (atnd-s8b extension)
- [ ] B1 WhatsApp dual stack production (F1-S03 + F1-S04)

### Q3 2026 (set-nov)
- [ ] W4 Trigger Links service
- [ ] W5 Right-rail contextual
- [ ] Lead Scoring nativo (4)
- [ ] Manual Actions queue (5)

### Q4 2026 (dez-fev)
- [ ] B2 Conversation AI com handoff (Jarvis V2 — FIC piloto)
- [ ] Visual workflow builder (upgrade atnd-s8a)
- [ ] Knowledge Base / RAG consolidar em ecosystem_memory

### Q1 2027
- [ ] B3 ERP-Educacional v2 (LMS + Certificates + Community + Client Portal)
- [ ] Custom Objects (platform-level)

### Q2+ 2027
- [ ] Voice AI receptionista (Jarvis V3)
- [ ] Branded Mobile App (FIC/Klésis)

---

## Perguntas abertas para decidir

1. **Intentus vira "mini-GHL BR imobiliário"** ou mantém foco enxuto em gestão de imóveis + lead?
2. **FIC vira plataforma educacional completa** (LMS + comunidade + app) ou fica como ERP administrativo?
3. **Jarvis evolui para vender** pras outras empresas (SaaS standalone) ou fica como ferramenta interna?
4. **Stack Meta Cloud API oficial** é prioridade para B2B enterprise, ou não-oficial (Baileys) é suficiente pra target SMB?

Essas respostas reconfiguram a ordem do roadmap. Benchmark WeSales ajuda a dimensionar **o teto do mercado** (all-in-one plataforma BR ~ GHL), mas cada aposta grande precisa validação com tripé BAM.
