# Análise Profunda — Verticais + Brasil (10 repos, código-fonte real)

> Inclui: Chatwoot, Documenso, Twenty, i-Educar, Evolution API, go-whatsapp-multidevice, sped-nfe, pyHanko, PyNFe, maritalk-api

I have sufficient data across all 10 repos. Here is the structured deep-analysis report.

---

# Deep Analysis: BR Vertical & Integrations Stack (2026-04-15)

Scope: 10 repos under `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/`. Mapping to the 5 businesses (FIC, KlÃ©sis, Intentus, Splendori, Nexvy).

---

## 1. chatwoot/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/chatwoot/`

1. **What it does:** Omnichannel customer support platform (open-source Intercom/Zendesk alternative). Unifies WhatsApp, Email, Web Chat, FB/Instagram, Twitter, Telegram, Line, SMS, Twilio into a single inbox. Captain = built-in AI agent. Help center portal, canned responses, automation rules, agent assignment, CSAT, campaigns, reporting.
2. **Architecture:**
   - Ruby on Rails monolith + Vue 3 frontend (Vite, Tailwind). Postgres + Redis + Sidekiq.
   - Enterprise overlay under `enterprise/` that extends OSS via `prepend_mod_with`.
   - Key abstractions: `Channel::*` polymorphic (api, email, facebook_page, instagram, line, sms, telegram, tiktok, twilio_sms, twitter_profile, web_widget, whatsapp). `Inbox` wraps a `Channel`. `Contact`, `Conversation`, `Message`, `AgentBot`, `AutomationRule`, `Macro`, `Campaign`.
   - WhatsApp channel supports `whatsapp_cloud` (Meta) and `default` (360dialog). Pluggable via `Whatsapp::Providers::*Service`.
3. **Business fit:**
   - **Nexvy (primary):** This IS the base for Nexvy's multi-channel comms product. The channel abstraction + automation engine are exactly the core.
   - **FIC + KlÃ©sis:** Parent/student support inbox (secretaria, pedagÃ³gico, financeiro) â one Chatwoot tenant per instituiÃ§Ã£o with WhatsApp + Email.
   - **Intentus:** Support inbox for tenant-facing SaaS (customer success). Also embeddable chat widget on the app.
   - **Splendori:** Lead qualification inbox (site â WhatsApp â CRM). Chatwoot acts as first-line concierge before handoff to Intentus CRM or sales.
4. **Reuse vs study:** **FORK + self-host for Nexvy.** License is MIT on OSS (but with Enterprise overlay; need to strip or license `enterprise/` features if commercialized). Integrate as a standalone service for FIC/KlÃ©sis/Intentus/Splendori via its API + webhooks â do NOT fork for them, just deploy.
5. **Gotchas:**
   - Rails 7 monoliths are heavy on Railway (Postgres + Redis + Sidekiq + web + worker processes). Budget ~512MBâ1GB RAM minimum per tenant.
   - Branding: use `replaceInstallationName` (see CLAUDE.md) to white-label for Nexvy.
   - `whatsapp_cloud` requires Meta approval + business verification. For Baileys (unofficial), pair with Evolution API (see item 5).
   - Translations policy: only `en.yml`/`en.json` editable; PT-BR comes from Crowdin community â not guaranteed complete.
   - Enterprise overlay is a hard-fork risk if you customize. Keep changes behind extension points.

---

## 2. documenso/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/documenso/`

1. **What it does:** Open-source DocuSign alternative. Upload PDF â define signers + fields â collect signatures with audit trail â get signed PDF with embedded digital signature + optional RFC 3161 timestamp.
2. **Architecture:**
   - TypeScript monorepo (Turbo). Remix app (`apps/remix`) + docs (`apps/docs`) + public API (`apps/openpage-api`).
   - Packages: `prisma` (Postgres), `trpc`, `auth`, `signing`, `email`, `lib`, `ui`, `ee` (Enterprise).
   - `packages/signing/index.ts` = signing orchestrator. Two transports: `local.ts` (local PKCS#12 cert) and `google-cloud.ts` (GCP HSM). Env var `NEXT_PRIVATE_SIGNING_TRANSPORT` switches.
   - Deployable via `railway.toml` + `render.yaml`.
3. **Business fit:**
   - **Intentus (primary):** Core CLM for contratos de locaÃ§Ã£o, distratos, termos aditivos, vistoria. Tenant workflow: landlord uploads, tenant signs via link, signed PDF archived. Full audit trail.
   - **Splendori:** Contratos de compra e venda, adesÃ£o a lanÃ§amento, termos de reserva de unidade, tabelas de preÃ§o assinadas.
   - **FIC/KlÃ©sis:** MatrÃ­cula assinada digitalmente pelos pais, termos de compromisso, contratos com fornecedores/professores.
   - **Nexvy:** Contratos de prestaÃ§Ã£o de serviÃ§o SaaS com clientes.
4. **Reuse vs study:** **FORK or self-host + use as CLM service.** License: AGPLv3 (check!). AGPLv3 on a SaaS means if you modify and expose over network you must open-source modifications. Safer path: self-host unmodified and integrate via API, or talk to them about Enterprise license.
5. **Gotchas:**
   - **AGPLv3 license** â this is the biggest dealbreaker. If you customize heavily inside Intentus/Splendori, you must publish the changes. Keep it as a standalone service.
   - Signing transports are **NOT ICP-Brasil aware** out of the box. To produce PAdES signatures with ICP-Brasil certs valid as "assinatura qualificada" (MP 2.200-2/2001), you'd swap `signing/transports/local.ts` with a pyHanko-backed pipeline OR add a new transport.
   - "Documenso-signed" is legally "assinatura eletrÃ´nica simples/avanÃ§ada" in BR, not "qualificada" unless wired to ICP-Brasil.

---

## 3. twenty/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/twenty/`

1. **What it does:** Modern open-source CRM (Notion/Airtable-inspired). Custom objects & fields per workspace, views (kanban/table), roles & permissions, workflow automation, emails/calendar/files sync.
2. **Architecture:**
   - Nx monorepo, Yarn 4. `twenty-front` (React 18 + Jotai + Linaria + Vite), `twenty-server` (NestJS + TypeORM + Postgres + Redis + GraphQL Yoga + BullMQ), `twenty-ui`, `twenty-shared`, `twenty-emails` (React Email), `twenty-website` (Next.js).
   - **Multi-tenant with schema-per-workspace** (core + metadata + per-workspace schemas). ClickHouse optional for analytics.
   - Strict TS, no `any`, named exports only, no enums (string literals), Composition API-style.
3. **Business fit:**
   - **Splendori (primary):** Lead â oportunidade â unidade reservada â contrato â pÃ³s-venda. Custom objects for "Empreendimento", "Unidade", "Reserva", "Proposta".
   - **Intentus:** CRM layer for property management company clients (landlords as accounts, properties as custom object, contracts as pipeline). Could be the CRM shell that Intentus embeds.
   - **FIC:** Alunos prospects, funil vestibular/ENEM â matrÃ­cula. Workflow auto â email + WhatsApp.
   - **KlÃ©sis:** Pipeline de matrÃ­culas de novas famÃ­lias.
   - **Nexvy:** CRM for Nexvy's own B2B sales.
4. **Reuse vs study:** **STUDY + selective fork.** License is AGPLv3 (same issue as Documenso). Alternative: use as SaaS. Given the ecosystem is monorepo + Railway, running twenty-server alongside Nexvy is viable but heavy. Consider extracting patterns (multi-tenant metadata schema, workflow engine) rather than hosting the whole thing for every business.
5. **Gotchas:**
   - **AGPLv3** â same concern as Documenso. If you modify to add BR fields (CPF/CNPJ, CEP auto-lookup), you may owe upstream.
   - Heavy stack (Postgres per-workspace schemas + Redis + BullMQ + optional ClickHouse). Expect 1GB+ RAM baseline per instance on Railway.
   - No native BR integrations (CEP, CPF/CNPJ, Banco Central) â need custom fields or companion services.
   - GraphQL-first; if other ecosystem services are REST, you'll build a gateway.

---

## 4. i-educar/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/i-educar/`

1. **What it does:** Brazilian K-12 + early-ed school management SaaS, MEC/INEP-aware. Originally from Prefeitura de ItajaÃ­-SC (2008). Core: matrÃ­cula, turmas, calendÃ¡rio, avaliaÃ§Ã£o/boletim, frequÃªncia, ocorrÃªncias, biblioteca, transporte, **Educacenso export** (INEP's federal school census), servidores, recursos humanos.
2. **Architecture:**
   - **Legacy PHP (procedural) + Laravel modern layer.** `ieducar/intranet/` = legacy PHP files (hundreds of `educar_*.php` scripts like `educar_matricula_cad.php`, `educar_boletim_*`). `src/` = Laravel modules (`src/Modules/`: AcademicYear, Enrollments, Educacenso, EvaluationRules, SchoolClass, People, Reports, Stages, etc.). `src/Legacy/` bridges old and new.
   - Postgres. Laravel 10+ with Blade, `composer.json` + `package.json` dual tooling, Vite.
   - Educacenso exporter (`educacenso_json/` + `Modules/Educacenso`) produces the INEP JSON for the federal census â **this is the crown jewel for BR compliance.**
3. **Business fit:**
   - **KlÃ©sis (primary):** Direct fit. K-12 colÃ©gio needs matrÃ­cula, boletim, diÃ¡rio, Educacenso. Fork or deploy directly.
   - **FIC:** Partially applicable. Higher-ed (Ensino Superior) has different regulators (MEC/e-MEC + INEP Censup, not Educacenso). Models for alunos, turmas, matrÃ­cula, avaliaÃ§Ã£o are reusable but e-MEC/Enade/Censup exports are MISSING â would need a sibling module.
   - **Intentus/Splendori/Nexvy:** Not applicable.
4. **Reuse vs study:** **FORK for KlÃ©sis (plan for 12-month modernization).** GPL v2 (confirm in LICENSE). For FIC, **study the regulatory patterns** (Educacenso JSON structure, validation rules, INEP codes) and rebuild clean for higher-ed. Do NOT try to bend i-Educar to ES.
5. **Gotchas:**
   - Legacy PHP is brittle â hundreds of `educar_*_cad.php`/`_lst.php`/`_det.php` files in procedural style. Modernization is non-trivial.
   - Educacenso layouts change yearly â upstream i-Educar community keeps up, fork drift is risky.
   - Dual tooling (legacy PHP + Laravel) requires both ecosystems running.
   - GPL v2: OK for KlÃ©sis SaaS to own customers, but you must offer source to your users if distributing.
   - Heavy stack: Postgres + PHP-FPM + Nginx; not trivially Railway-friendly compared to pure-Node projects.

---

## 5. evolution-api/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/evolution-api/`

1. **What it does:** Brazilian-made REST API gateway for WhatsApp â both Baileys (WhatsApp Web unofficial) and Meta Business Cloud API. Multi-tenant ("instances"). Built-in integrations for Chatwoot, Typebot, Dify, OpenAI, Flowise, N8N, Evolution Bot, Chatwoot bidirectional sync.
2. **Architecture:**
   - Node.js 20+ / TypeScript 5 / Express. Multi-tenant SaaS. Postgres OR MySQL via Prisma (schema-per-provider in `prisma/`).
   - `src/api/integrations/channel/` â Baileys, Business API, Evolution; `integrations/chatbot/` â OpenAI, Dify, Typebot, Chatwoot, Flowise, N8N, EvoAI; `integrations/event/` â WebSocket, RabbitMQ, SQS, NATS, Pusher; `integrations/storage/` â S3, MinIO.
   - API-key auth (global + per-instance), RouterBroker pattern with JSONSchema7 validation, EventEmitter2 internal, BullMQ-like queues external.
3. **Business fit:**
   - **Nexvy (primary):** THE message-layer gateway. Chatwoot â Evolution API â WhatsApp. Nexvy orchestrates many client WhatsApp numbers as "instances".
   - **FIC/KlÃ©sis/Intentus/Splendori (all):** All need WhatsApp. Each can provision instances through Nexvy (or directly). Chatwoot via Evolution is the standard BR stack.
4. **Reuse vs study:** **SELF-HOST + integrate as service.** License: Apache 2.0 â most permissive of all BR repos. Fork if needed. This is the safest BR integration to commercialize.
5. **Gotchas:**
   - **Baileys mode = WhatsApp Web unofficial.** Meta can and does ban. For production, use Cloud API whenever possible.
   - FFmpeg required for media conversion.
   - Multi-tenant instance management: each WhatsApp session has a unique name, auto-reconnect with backoff.
   - PT-BR project, all comments in Portuguese per their CLAUDE.md.
   - No formal tests â "manual testing primary approach."
   - Webhook storm risk at scale â plan Redis + RabbitMQ upfront.

---

## 6. go-whatsapp-web-multidevice/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/go-whatsapp-web-multidevice/`

1. **What it does:** Go-based WhatsApp Web gateway (whatsmeow-based). Exposes REST + MCP (Model Context Protocol) + WebSocket + built-in Chatwoot bidirectional sync. Multi-device (v8+). Lighter memory footprint than Node-based alternatives.
2. **Architecture:**
   - Clean Architecture: `domains/` (contracts) â `usecase/` (business) â `ui/rest` + `ui/mcp` (delivery).
   - `infrastructure/whatsapp/` (29 files) wraps whatsmeow. `infrastructure/chatstorage/` = SQLite default or Postgres. `infrastructure/chatwoot/` = bidirectional sync (`client.go` + `sync.go`).
   - Fiber HTTP framework + Cobra/Viper CLI + ozzo-validation. go:embed for Vue.js assets. Migrations append-only via `getMigrations()`.
   - REST and MCP cannot run simultaneously (whatsmeow limitation).
3. **Business fit:**
   - **Nexvy (alternative to Evolution API):** Lighter, Go-native, with built-in MCP. If Nexvy wants an AI-agent-first architecture (Claude/MCP tool calls direct to WhatsApp), this beats Evolution API.
   - **Jarvis project (the user's personal AI system):** MCP mode lets Jarvis call WhatsApp tools directly.
   - **Others (FIC/KlÃ©sis/Intentus/Splendori):** Could replace Evolution API if lighter resource use matters and no need for Typebot/Dify integrations.
4. **Reuse vs study:** **SELF-HOST or study for MCP patterns.** License is in LICENCE.txt â verify (likely MIT). Fork-friendly. Strong candidate for Jarvis integration.
5. **Gotchas:**
   - Baileys-equivalent (whatsmeow) = unofficial protocol; same Meta-ban risk as Evolution API Baileys mode.
   - REST/MCP single-mode: can't expose both simultaneously â architectural constraint.
   - FFmpeg required.
   - Device ID vs JID is a documented footgun â their CLAUDE.md warns explicitly.
   - Fewer chatbot integrations out-of-box vs Evolution API (no Typebot/Dify/OpenAI wrappers), but has Chatwoot sync built-in.

---

## 7. sped-nfe/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/sped-nfe/`

1. **What it does:** PHP library for Brazilian NF-e (modelo 55) + NFC-e (modelo 65). Generate XML, sign, transmit to SEFAZ webservices, handle eventos (cancelamento, carta de correÃ§Ã£o, inutilizaÃ§Ã£o, manifestaÃ§Ã£o do destinatÃ¡rio), consultas. Up-to-date with current NTs including RTC (Reforma TributÃ¡ria do Consumo) 2025.
2. **Architecture:**
   - PHP 7.4+/8.x, Composer package `nfephp-org/sped-nfe`. PSR-1/2/4.
   - `src/Make.php` = XML builder for NF-e. `src/Tools.php` = SEFAZ webservice client. `src/Complements.php` = post-processing (DANFE, protocol merge). `src/Common/` = `Config.php`, `Webservices.php`, `Standardize.php`, `Gtin.php`, `Tools.php` (base).
   - `src/Traits/` â many, including `TraitCalculations`, `TraitEventsRTC` (Reforma TributÃ¡ria), `TraitTagCobr`, `TraitTagComb`, `TraitEPECNfce`, `TraitTagAutXml`. Composition-via-traits for giant NFe XML tag surface.
   - `src/Factories/` for signing and XML manipulation. Schemas in `schemes/` (by UF and PL version).
3. **Business fit:**
   - **Intentus:** Emitir NF-e de serviÃ§o (locaÃ§Ã£o) OR NFS-e via companion sped-nfse? This repo is NF-e/NFC-e only. LocaÃ§Ã£o is NFS-e (municipal) â use PyNFe or `nfephp-org/sped-nfse` instead.
   - **Splendori:** NF-e on material and services purchases; may need to issue boletos/recibos more than NF-e directly.
   - **FIC/KlÃ©sis:** **Yes** â mensalidades escolares have NFS-e requirements in most municÃ­pios. But they need **NFS-e** (not NF-e/NFC-e). This lib doesn't cover NFS-e.
   - **Nexvy:** Emitir NF-e para Nexvy's billing (venda de serviÃ§o SaaS = NFS-e).
4. **Reuse vs study:** **USE AS DEPENDENCY (Composer).** MIT license. Community-maintained (nfephp-org). Doesn't duplicate PyNFe â they're complementary ecosystems (PHP vs Python). Pick per language.
5. **Gotchas:**
   - PHP. If the monorepo is Node/TS primarily, expose this via a thin PHP microservice (sidecar) OR port to Node/Python call.
   - BR tax law changes yearly (NTs); must track upstream releases.
   - Digital certificate (A1/A3) handling is tricky on serverless / Railway â need PFX storage + proper key handling.
   - HomologaÃ§Ã£o vs ProduÃ§Ã£o environments mandatory.
   - **Not NFS-e** â for serviÃ§os municipais you need `nfephp-org/sped-nfse` OR PyNFe.

---

## 8. pyHanko/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/pyHanko/`

1. **What it does:** Python library + CLI for PDF digital signatures. **PAdES B-B, B-T, B-LT, B-LTA** profiles, LTV, RFC 3161 timestamps, PKCS#11 (ICP-Brasil A3 smartcards/tokens!), RSA/DSA/ECDSA/EdDSA. Stamping, signature field management, encryption, validation including AdES + EU trusted lists.
2. **Architecture:**
   - Python 3.10+. `pyhanko/sign/` = signing engine. `pyhanko/pdf_utils/` = PDF core (forked from PyPDF2). `pyhanko/stamp/` = visual stamps. `pyhanko/cli/` in a separate `pyhanko-cli` package.
   - PKCS#11 wrapper for HSM / ICP-Brasil tokens.
   - Beta per README but widely used in EU qualified signatures.
3. **Business fit:**
   - **Intentus (primary):** Replace/augment Documenso's `packages/signing/transports/local.ts` to produce PAdES-qualified signatures using ICP-Brasil A1/A3 certs â legally "assinatura qualificada" per MP 2.200-2 / Lei 14.063/2020. Massive legal upgrade for locaÃ§Ã£o contracts.
   - **Splendori:** Contratos de compra e venda / escrituras with ICP-Brasil signature â same story.
   - **FIC/KlÃ©sis:** Diplomas digitais, histÃ³rico escolar (MEC mandates digital diploma ICP-Brasil since Portaria 330/2018 for HE, 554/2021). pyHanko is the right core.
   - **Nexvy:** Internal contracts signed by Nexvy as legal entity.
4. **Reuse vs study:** **USE AS LIBRARY.** MIT. Strongest candidate for BR compliance core for any business that signs PDFs.
5. **Gotchas:**
   - "Beta, not yet production-ready" per their own README â but widely deployed anyway. Test thoroughly.
   - PKCS#11 with ICP-Brasil A3 tokens requires hardware. For cloud, use A1 certificates (PKCS#12 PFX) or an HSM service (AWS CloudHSM, DocGuard, ValidCertificadora).
   - Python sidecar in a TS monorepo â need FastAPI/Flask microservice or CLI wrap.
   - No native integration with Documenso â you build the bridge.
   - Trusted list validation EU-oriented; ICP-Brasil trust anchors must be manually loaded (ITI publishes `.pem` chain).

---

## 9. PyNFe/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/PyNFe/`

1. **What it does:** Python library covering **NF-e, NFC-e, NFS-e (Abrasf/Ginfes/Betha), MDF-e, partial CT-e.** Broader document coverage than sped-nfe. Supports eventos (cancelamento, carta de correÃ§Ã£o, inutilizaÃ§Ã£o, manifestaÃ§Ã£o, distribuiÃ§Ã£o DF-e).
2. **Architecture:**
   - `pynfe/entidades/` â domain objects (Emitente, Destinatario, Produto, NotaFiscal, etc.). `pynfe/processamento/` â builders, serializers, comunicadores (SEFAZ webservice clients), assinatura. `pynfe/data/` â schemas and reference data. `pynfe/utils/` â helpers.
   - Dependencies: lxml, signxml, pyOpenSSL, requests; suds-community + PyXB-X for NFS-e SOAP.
   - Python 3.8â3.13.
3. **Business fit:**
   - **FIC/KlÃ©sis (primary among BR docs):** NFS-e for mensalidades is the real need. PyNFe covers Abrasf/Ginfes/Betha â most municÃ­pios use one of these.
   - **Intentus:** NFS-e for locaÃ§Ã£o (aluguel de imÃ³vel = serviÃ§o tributÃ¡vel em muitos municÃ­pios).
   - **Splendori:** NF-e for venda de unidades (incorporaÃ§Ã£o) + NFS-e on commissioning/serviÃ§os. MDF-e if there's logistics.
   - **Nexvy:** NFS-e for SaaS.
4. **Reuse vs study:** **USE AS LIBRARY (pip).** License: unknown from README (check LICENSE â likely MIT/LGPL). Complements sped-nfe if you need Python stack or NFS-e.
5. **Gotchas:**
   - **Overlap with sped-nfe:** PyNFe (Python) and sped-nfe (PHP) are **parallel, competing ecosystems**. Pick ONE per language. They do NOT complement each other unless you really have both PHP and Python services.
   - **PyNFe has NFS-e + MDF-e** (sped-nfe core doesn't; you'd need sibling sped-nfse). If you need NFS-e and prefer Python, PyNFe wins.
   - Older SOAP deps (suds-community, PyXB-X) are finicky; NFS-e authorizers are the flakiest part of Brazilian tax stack (each municÃ­pio = different endpoint, often broken).
   - Python 3.13 support = actively maintained.
   - CT-e mostly "a fazer" â incomplete.

---

## 10. maritalk-api/
**Path:** `/Users/marcelosilva/Downloads/ECOSSISTEMA-ARQUIVOS-2026-04-15/research-repos/maritalk-api/`

1. **What it does:** API + SDK for **MariTalk** (Maritaca AI) â Brazilian LLM "SabiÃ¡" family (sabia-4, sabiazinho-4), optimized for Portuguese and Brazilian context. Pay-as-you-go. **OpenAI-compatible endpoint** (`https://chat.maritaca.ai/api`) â drop-in replacement.
2. **Architecture:**
   - Python package `maritalk` (token counting utilities). OpenAI SDK is the main client.
   - `maritalk/` source, `sagemaker/` (AWS deploy), `examples/`, `documentation/`, `docs_deprecated/`. Has Dockerfile for local/on-prem deploys (see `README-Local.md`).
   - LangChain integration (`langchain_community.chat_models.ChatMaritalk`) and LlamaIndex integration exist.
3. **Business fit:**
   - **All 5 businesses â LLM layer:**
     - Jarvis (personal AI stack): SabiÃ¡-4 for PT-BR-native responses, cultural/legal context, cheaper than Claude for bulk.
     - Nexvy agent replies to customers (PT-BR tone).
     - FIC/KlÃ©sis: atendimento a alunos/pais, correÃ§Ã£o/feedback pedagÃ³gico, geraÃ§Ã£o de materiais.
     - Intentus: atendimento inquilinos/proprietÃ¡rios, geraÃ§Ã£o de laudos/descriÃ§Ãµes de imÃ³vel.
     - Splendori: descriÃ§Ãµes de lanÃ§amentos, qualificaÃ§Ã£o de lead via chat, follow-ups.
4. **Reuse vs study:** **USE AS PROVIDER (via OpenAI SDK).** Also has local/on-prem Docker for air-gapped scenarios (README-Local.md). Commercial API; no license concern for usage, only Terms of Service.
5. **Gotchas:**
   - OpenAI-compatible but not 100% feature-parity (verify tool calling, structured outputs, vision â may lag).
   - Pricing in BRL, creditos prepagos. R$20 free on first card.
   - For agent ecosystem, use as a model **alongside** Claude (ex: SabiÃ¡-4 for high-volume PT-BR customer touchpoints; Claude for reasoning/Jarvis core).
   - Local deploy requires GPU (not documented here but typical for LLM Docker).
   - No guarantee of long-term API stability â younger provider than OpenAI/Anthropic.

---

## Cross-Repo Insights

### A. The "BR Omnichannel Stack" (proven combo)
**Chatwoot + Evolution API + Documenso** is indeed the canonical BR stack for customer ops + signatures:
- Evolution API â WhatsApp connectivity (both Baileys + Cloud API)
- Chatwoot â inbox + agent UI + automation + Captain AI
- Documenso â signing pipeline called from Chatwoot automation rules
- Evolution API has **native Chatwoot integration in `src/api/integrations/chatbot/chatwoot/`** â zero glue code for the first two.

For Nexvy as productized offering: Chatwoot (forked, white-labeled) + Evolution API (self-hosted, multi-tenant instances) + optional go-whatsapp-web-multidevice for MCP-first clients.

### B. i-Educar's MEC/INEP patterns applicable to FIC
i-Educar's `src/Modules/Educacenso/` shows how BR regulatory exports are structured:
- JSON shape mirrors INEP's census layout (escola, turmas, alunos, docentes â each year's layout).
- Validation rules enforced before export (no nulls in mandatory fields, codes from INEP reference tables).
- `ieducar/intranet/educacenso_json/` legacy builder scripts.

**For FIC (higher-ed):** MEC/INEP equivalents are **e-MEC** (institutional data), **Censup** (annual census of ES), and **Enade** (student eval). There's no open-source equivalent of i-Educar for HE in Brazil that I'm aware of in this repo set. The playbook is: **reuse i-Educar's patterns** (regulatory-module-as-Laravel-module, JSON-builder with reference-table validation) but build fresh for HE. Do NOT fork i-Educar for FIC â schema mismatch is too deep.

### C. sped-nfe vs PyNFe vs pyHanko â who does what
- **sped-nfe** (PHP): NF-e + NFC-e only (core). Complement needed: `nfephp-org/sped-nfse` for services, `sped-mdfe` for transport.
- **PyNFe** (Python): NF-e + NFC-e + NFS-e + MDF-e + partial CT-e. **Single package, broader coverage**, but NFS-e and CT-e are rougher.
- **pyHanko** (Python): PDF signing â **different problem entirely**. Used for signing arbitrary PDFs (contratos, diplomas, laudos), not XML NFe signatures.
- **XML NFe signing** is done *inside* sped-nfe/PyNFe via `signxml` (Python) or `robrichet/xmlseclibs` (PHP) â not pyHanko.

**They do NOT duplicate.** Recommendation:
- If ecosystem is Python-majority â **PyNFe + pyHanko**.
- If ecosystem has a PHP sidecar â **sped-nfe (for NFe) + PyNFe-via-bridge (for NFS-e) + pyHanko (PDFs)**.
- Avoid running both PyNFe and sped-nfe in same stack.

### D. LLM routing
MariTalk (SabiÃ¡) should sit behind a router (LiteLLM in your repo set) as the **PT-BR-default** model. Jarvis selects Claude for reasoning/tool-use, SabiÃ¡ for high-volume customer-facing PT-BR, GPT/others as fallback. The OpenAI-compatible endpoint makes LiteLLM routing trivial.

### E. License matrix (important for commercialization)
| Repo | License | Commercial safe? |
|---|---|---|
| Chatwoot OSS | MIT | Yes (watch Enterprise overlay) |
| Documenso | **AGPLv3** | **Risky if modified** |
| Twenty | **AGPLv3** | **Risky if modified** |
| i-Educar | GPL v2 | SaaS use OK; distribution needs source |
| Evolution API | Apache 2.0 | Yes |
| go-whatsapp-web-multidevice | check LICENCE.txt | probably yes |
| sped-nfe | MIT | Yes |
| pyHanko | MIT | Yes |
| PyNFe | check LICENSE | likely MIT/LGPL |
| MariTalk API | Commercial ToS | Yes (paid) |

---

## Recommended BR Stack per Business

### FIC (Faculdades Integradas de CassilÃ¢ndia â Ensino Superior)
- **Comms:** Chatwoot + Evolution API (WhatsApp matrÃ­cula + atendimento aluno/professor).
- **Signing:** Documenso (AGPL, self-host, don't modify) + pyHanko sidecar for ICP-Brasil PAdES on diplomas digitais (**required by MEC Portaria 554/2021**).
- **Fiscal:** PyNFe for NFS-e mensalidades (CassilÃ¢ndia-MS municÃ­pio authorizer).
- **Regulatory:** **Build fresh "Censup/e-MEC exporter module"** using i-Educar's pattern as reference (study-only, do not fork).
- **CRM:** Twenty for funil vestibular (or lighter â Chatwoot contact segments).
- **LLM:** MariTalk (SabiÃ¡-4) for aluno/suporte pedagÃ³gico PT-BR; Claude for Jarvis/operacional.

### KlÃ©sis (ColÃ©gio K-12)
- **Core:** **Fork i-Educar** (matrÃ­cula, boletim, diÃ¡rio, **Educacenso INEP exporter** built-in). This is the single biggest value in the repo set for KlÃ©sis.
- **Comms:** Chatwoot + Evolution API for pais/responsÃ¡veis.
- **Signing:** Documenso + pyHanko for matrÃ­cula digitalmente assinada.
- **Fiscal:** PyNFe for NFS-e mensalidades.
- **LLM:** MariTalk para comunicaÃ§Ã£o com famÃ­lias; Claude para suporte pedagÃ³gico ao corpo docente via Jarvis.

### Intentus (Real-Estate SaaS, property management)
- **CRM shell:** Twenty (study patterns; for MVP use custom Postgres schema â avoid AGPL exposure).
- **CLM:** **Documenso (self-host, unmodified) + pyHanko microservice (ICP-Brasil PAdES qualified signatures)** â legal-grade digital locaÃ§Ã£o contracts. This is the flagship differentiator vs competitors.
- **Comms:** Chatwoot + Evolution API (tenant â landlord â manager multi-channel).
- **Fiscal:** PyNFe NFS-e for locaÃ§Ã£o + administraÃ§Ã£o.
- **LLM:** MariTalk for tenant chat; Claude for legal/complex reasoning.

### Splendori (IncorporaÃ§Ã£o ImobiliÃ¡ria Piracicaba)
- **CRM:** Twenty (lead â reserva â venda funnel with custom objects "Empreendimento", "Unidade").
- **CLM:** Documenso + pyHanko for contratos de compra e venda ICP-Brasil.
- **Comms:** Chatwoot + Evolution API for lead qualification + pÃ³s-venda.
- **Fiscal:** sped-nfe OR PyNFe for NF-e of any material sales + PyNFe for NFS-e on commissions.
- **LLM:** MariTalk for site chat; Claude for Jarvis orchestration.

### Nexvy (Multi-channel Comms platform â the omnichannel SaaS)
- **Core:** **Fork Chatwoot + white-label** (replaceInstallationName) as Nexvy's product.
- **Message gateways:** **Evolution API** (multi-tenant, BR-standard) as primary; **go-whatsapp-web-multidevice** as secondary/alternative (lighter, MCP-native for AI-agent-first clients â Jarvis and competitors).
- **Built-in CLM:** integrate Documenso as optional add-on (sell "Nexvy Sign" as upsell).
- **CRM:** Twenty as optional integration (Nexvy â Twenty via API).
- **LLM:** MariTalk as default PT-BR agent engine; Claude for sophisticated automations; routed via LiteLLM.
- **Revenue model:** Nexvy multi-tenant charges per WhatsApp instance + per active agent + Documenso/Twenty bolt-ons.

---

## Key Decisions/Watch-outs for Ecosystem Plan

1. **AGPLv3 trap (Documenso + Twenty):** Self-host unmodified. Never fork into proprietary code. For any Intentus/Splendori/Nexvy customizations, build companion microservices that call their APIs rather than editing source.
2. **ICP-Brasil qualified signatures = pyHanko sidecar.** Treat as mandatory for MEC diplomas (FIC), high-value contracts (Splendori), and legal-locaÃ§Ã£o positioning (Intentus competitive edge).
3. **i-Educar for KlÃ©sis only** â do not try to stretch to FIC.
4. **sped-nfe vs PyNFe â pick one per stack.** In a Python-leaning monorepo, choose PyNFe. Only run both if a PHP module is already there.
5. **Chatwoot + Evolution API is battle-tested as a pair.** Evolution ships native Chatwoot integration. Start there for Nexvy MVP.
6. **MariTalk via OpenAI SDK + LiteLLM router** is the lowest-friction way to add PT-BR-optimized LLM across all 5 businesses.
7. **Railway resource budget:** Chatwoot + Evolution API + Postgres + Redis per Nexvy tenant is ~1.5â2GB RAM floor. Plan for managed Postgres (Neon/Supabase per the 2026-04-15 decisions) and Redis add-on rather than sidecars.

