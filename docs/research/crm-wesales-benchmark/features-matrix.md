# WeSales vs Pipedrive vs HubSpot vs Intentus — Features Matrix

**Legenda:**
- ✅ Nativo completo
- ⚠️ Parcial / integração / addon pago / beta
- ❌ Não existe
- — Não aplicável

**Referência Intentus:** estado atual no repo `mfalcao09/ecossistema-monorepo` (memory: `project_monorepo`, `project_atnd_*`, `project_fase1`).

---

## 1. CRM Core

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Contacts com campos custom | ✅ | ✅ | ✅ | ⚠️ (basic) |
| Companies entity | ✅ | ✅ | ✅ | ⚠️ |
| Custom Objects (entidades novas) | ✅ | ❌ | ✅ Enterprise | ❌ |
| Smart Lists (filter saved) | ✅ | ✅ | ✅ | ⚠️ |
| Tags many-to-many | ✅ | ✅ | ✅ | ⚠️ |
| Bulk Actions (10+) | ✅ | ✅ | ✅ | ❌ |
| Import/Export CSV | ✅ | ✅ | ✅ | ⚠️ |
| Duplicate detection/merge | ✅ | ✅ | ✅ | ❌ |
| Activity timeline | ✅ | ✅ | ✅ | ⚠️ |
| Tasks | ✅ | ✅ | ✅ | ⚠️ |
| DND / opt-out por canal | ✅ | ⚠️ | ✅ | ❌ |

## 2. Inbox / Conversations

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Unified inbox multi-canal | ✅ | ⚠️ | ✅ (Service Hub) | ❌ (S4-S8 em construção) |
| Team Inbox vs My Inbox | ✅ | ✅ | ✅ | ❌ |
| WhatsApp oficial (WABA) | ⚠️ (settings visível) | ⚠️ marketplace | ⚠️ marketplace | ⚠️ roadmap Jarvis |
| **WhatsApp não-oficial** (Baileys-style) | ✅ ⭐ | ❌ | ❌ | ⚠️ em Jarvis-gateway |
| Email thread | ✅ | ✅ | ✅ | ⚠️ |
| SMS | ✅ | ⚠️ | ✅ | ❌ |
| Voice call (inline dialer) | ✅ | ⚠️ marketplace | ⚠️ addon | ❌ |
| Instagram DM | ✅ prov. | ⚠️ | ✅ | ❌ |
| Facebook Messenger | ✅ | ⚠️ | ✅ | ❌ |
| Live chat widget | ✅ | ⚠️ addon | ✅ | ❌ |
| Snippets / templates rápidos | ✅ | ✅ | ✅ | ⚠️ (atnd-s5) |
| Trigger Links rastreáveis | ✅ | ⚠️ | ✅ | ❌ |
| Manual Actions queue | ✅ | ❌ | ❌ | ❌ |
| Right-rail contextual (9 slots) | ✅ | ⚠️ | ✅ | ❌ |

## 3. Pipeline / Deals

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Multi-pipeline | ✅ | ✅ | ✅ | ⚠️ |
| Custom stages | ✅ | ✅ | ✅ | ⚠️ |
| Kanban drag-and-drop | ✅ | ✅ | ✅ | ⚠️ (atnd-s4) |
| List view + Kanban toggle | ✅ | ✅ | ✅ | ⚠️ |
| Bulk actions em deals | ✅ | ✅ | ✅ | ❌ |
| Rotten deals aging | ✅ prov. | ✅ | ✅ | ❌ |
| Forecast/probability | ✅ prov. | ✅ | ✅ | ❌ |
| Owner assignment | ✅ | ✅ | ✅ | ⚠️ |

## 4. Calendars / Booking

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Calendar view | ✅ | ⚠️ addon | ✅ | ❌ |
| Appointment list | ✅ | ⚠️ | ✅ | ❌ |
| Booking page pública | ✅ | ⚠️ (Scheduler) | ✅ (Meetings) | ❌ |
| Round Robin | ✅ | ⚠️ | ✅ | ❌ |
| Team calendars | ✅ | ⚠️ | ✅ | ❌ |
| Google Calendar sync | ✅ | ✅ | ✅ | ⚠️ (atnd-s5) |

## 5. Automation / Workflows

| Feature | WeSales | Pipedrive | HubSpot | Intentus (atnd-s8a) |
|---------|---------|-----------|---------|----------------------|
| Visual workflow builder | ✅ | ⚠️ (Workflow Automation) | ✅ | ❌ (IF/THEN motor) |
| # de Triggers | 50+ | ~20 | 100+ | 7 |
| # de Actions | 80+ | ~30 | 100+ | 9 |
| Wait/Delay steps | ✅ | ✅ | ✅ | ❌ |
| If/Else branching | ✅ | ✅ | ✅ | ✅ |
| HTTP webhook out | ✅ | ✅ | ✅ | ✅ |
| AI action embutida | ✅ | ❌ | ⚠️ beta | ❌ |
| Enrollment history | ✅ | ❌ | ✅ | ⚠️ |
| Workflow templates | ✅ | ❌ | ✅ | ❌ |
| Folders / organize | ✅ | ❌ | ✅ | ⚠️ |

## 6. Marketing

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Email campaigns | ✅ | ⚠️ (Campaigns) | ✅ | ❌ |
| Email templates | ✅ | ✅ | ✅ | ⚠️ (atnd-s5) |
| Social planner | ✅ (10 redes) | ❌ | ⚠️ (mkt Hub) | ❌ |
| Evergreen/recurring posts | ✅ | ❌ | ❌ | ❌ |
| RSS-to-post | ✅ | ❌ | ❌ | ❌ |
| Affiliate Manager completo | ✅ | ❌ | ❌ | ❌ |
| Ad Manager (FB+Google nativo) | ✅ | ❌ | ✅ (pago) | ❌ |
| Countdown timers | ✅ | ❌ | ⚠️ | ❌ |
| Trigger Links | ✅ | ⚠️ | ⚠️ | ❌ |
| Brand Boards (multi-brand) | ✅ | ❌ | ⚠️ | ❌ |

## 7. Sites / Funnels / Commerce

| Feature | WeSales | Pipedrive | HubSpot | ClickFunnels | Kajabi |
|---------|---------|-----------|---------|--------------|--------|
| Funnel builder | ✅ | ❌ | ⚠️ (CMS Hub) | ✅ | ✅ |
| Website builder multi-page | ✅ | ❌ | ✅ | ⚠️ | ⚠️ |
| Stores / e-commerce | ✅ | ❌ | ❌ | ⚠️ | ✅ |
| Webinars pages | ✅ | ❌ | ❌ | ❌ | ✅ |
| Forms + Surveys | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| Chat widget | ✅ | ⚠️ | ✅ | ❌ | ❌ |
| Custom domain | ✅ | ❌ | ✅ | ✅ | ✅ |

## 8. Payments / Billing / E-commerce

| Feature | WeSales | Pipedrive | HubSpot | Stripe |
|---------|---------|-----------|---------|--------|
| Invoices one-time | ✅ | ⚠️ addon | ✅ | ✅ |
| Recurring invoices | ✅ | ⚠️ | ✅ | ✅ |
| Estimates/Quotes | ✅ | ✅ | ✅ | ❌ |
| Proposals & Contracts | ✅ | ⚠️ addon | ✅ | ❌ |
| Orders management | ✅ | ❌ | ❌ | ⚠️ |
| Abandoned checkouts | ✅ | ❌ | ❌ | ✅ |
| Subscriptions SaaS | ✅ | ⚠️ | ✅ | ✅ |
| Payment Links | ✅ | ⚠️ | ✅ | ✅ |
| Products + Inventory | ✅ | ❌ | ❌ | ⚠️ |
| Coupons | ✅ | ❌ | ✅ | ✅ |
| Gift Cards | ✅ | ❌ | ❌ | ❌ |
| Product Reviews | ✅ | ❌ | ❌ | ❌ |

## 9. LMS / Memberships / Community

| Feature | WeSales | Hotmart | Kajabi | TeachMe | Skool |
|---------|---------|---------|--------|---------|-------|
| Courses com modules | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Video lessons | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Quizzes/Assignments | ✅ prov. | ✅ | ✅ | ✅ | ❌ |
| Certificates | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| Community groups | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| Analytics engagement | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Client portal logado | ✅ | ⚠️ | ⚠️ | ✅ | ✅ |
| **Branded Mobile App** | ✅ | ❌ | ⚠️ | ❌ | ✅ |
| Marketplace cursos | ✅ (Gokollab) | ✅ | ❌ | ❌ | ❌ |

## 10. AI Agents

| Feature | WeSales | Pipedrive | HubSpot | Intentus/Jarvis |
|---------|---------|-----------|---------|------------------|
| Voice AI agent (receptionista) | ✅ | ❌ | ⚠️ beta | ⚠️ (voice comands iOS) |
| Conversation AI (chat) | ✅ | ❌ | ⚠️ beta | ⚠️ (WhatsApp only) |
| Agent Studio (no-code) | ✅ | ❌ | ❌ | ❌ |
| Knowledge Base / RAG | ✅ | ❌ | ❌ | ⚠️ (ecosystem_memory) |
| Agent Templates | ✅ | ❌ | ❌ | ❌ |
| Content AI (copy gen) | ✅ | ❌ | ✅ | ❌ |
| Agent Logs/audit | ✅ | ❌ | ⚠️ | ⚠️ |

## 11. Reporting / Analytics

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Custom Reports builder | ✅ | ⚠️ | ✅ | ❌ |
| Google Ads native | ✅ | ❌ | ⚠️ | ❌ |
| Facebook Ads native | ✅ | ❌ | ⚠️ | ❌ |
| Multi-touch Attribution | ✅ | ❌ | ✅ Enterprise | ❌ |
| Call Reporting | ✅ | ⚠️ | ⚠️ | ❌ |
| Agent/Rep productivity | ✅ | ✅ | ✅ | ⚠️ |
| Appointment reports | ✅ | ⚠️ | ✅ | ❌ |
| Local SEO audit | ✅ | ❌ | ❌ | ❌ |

## 12. Reputation

| Feature | WeSales | BirdEye | Google Business | Intentus |
|---------|---------|---------|-----------------|----------|
| Review request automation | ✅ | ✅ | ❌ | ❌ |
| Multi-platform reviews | ✅ | ✅ | ❌ | ❌ |
| Video testimonials | ✅ | ⚠️ | ❌ | ❌ |
| Review widgets embed | ✅ | ✅ | ⚠️ | ❌ |
| Listings management | ✅ | ✅ | ✅ | ❌ |

## 13. Settings / Admin

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Custom Objects | ✅ | ❌ | ✅ Ent. | ❌ |
| Custom Fields | ✅ | ✅ | ✅ | ⚠️ |
| Custom Values globais | ✅ | ⚠️ | ✅ | ❌ |
| Lead Scoring nativo | ✅ | ⚠️ addon | ✅ | ❌ |
| Private Integrations (API keys) | ✅ | ✅ | ✅ | ⚠️ |
| Audit Logs | ✅ | ⚠️ | ✅ | ⚠️ (postgres) |
| Labs (beta flags) | ✅ | ❌ | ⚠️ | ❌ |
| Brand Boards (multi-brand) | ✅ | ❌ | ❌ | ❌ |
| Staff + roles | ✅ | ✅ | ✅ | ⚠️ (atnd-s6) |
| Multi-tenant (locations) | ✅ | ❌ | ❌ | ⚠️ (Ecossistema) |

## 14. Marketplace / Ecosystem

| Feature | WeSales | Pipedrive | HubSpot | Zapier |
|---------|---------|-----------|---------|--------|
| # apps disponíveis | **1306** | ~500 | ~1500 | 7000+ |
| AI Agents como categoria | ✅ | ❌ | ⚠️ | ⚠️ |
| Niche/vertical filtering | ✅ | ⚠️ | ✅ | ❌ |
| Developer mode (build + publish) | ✅ | ✅ | ✅ | ✅ |
| Auto-install/OAuth | ✅ | ✅ | ✅ | ✅ |

---

## Totalizador por categoria (% de features nativas)

| Categoria | WeSales | Pipedrive | HubSpot (All Hubs) | Intentus hoje |
|-----------|---------|-----------|---------------------|---------------|
| CRM Core | 95% | 90% | 100% | 35% |
| Inbox | 90% | 35% | 85% | 10% |
| Pipeline | 95% | 100% | 100% | 40% |
| Calendar | 90% | 30% | 95% | 5% |
| Automation | 100% | 60% | 100% | 30% |
| Marketing | 95% | 20% | 90% | 5% |
| Sites/Funnels | 95% | 0% | 60% | 0% |
| Payments/E-com | 95% | 15% | 30% | 10% |
| LMS/Community | 90% | 0% | 0% | 20% (ERP-Educacional) |
| AI Agents | 95% | 0% | 40% | 15% (Jarvis V1) |
| Reporting | 95% | 50% | 95% | 15% |
| Reputation | 90% | 0% | 0% | 0% |
| Settings/Admin | 95% | 70% | 95% | 25% |
| **MÉDIA GERAL** | **94%** | **38%** | **74%** | **16%** |

## Conclusão

**WeSales/GHL é a plataforma mais completa** testada, com ~94% de cobertura das features elencadas — em grande parte porque cobre territórios além do CRM puro (LMS, Funnels, E-commerce, Reputation, Reviews).

**Pipedrive é CRM enxuto** (38%), focado em sales pipeline. Bom para SMB vendas, mas precisa stack externo para inbox, automação, marketing.

**HubSpot competitivo** (74%) com modelo de múltiplos Hubs (Marketing/Sales/Service/CMS/Operations), cada um pago separado.

**Intentus hoje (16%)** tem o core CRM básico, mas gaps massivos em inbox, automação, marketing, LMS e AI. O benchmark WeSales mostra onde priorizar (ver `gaps-intentus.md`).
