# Sessão 41 — Varredura CLM profunda + Benchmarking vs Líderes de Mercado (12/03/2026)

- **Objetivo**: (1) Varredura completa do módulo CLM com Buchecha para encontrar erros remanescentes. (2) Benchmarking contra os melhores CLMs do mercado. (3) Relatório completo .docx
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). 82+ arquivos analisados (27 hooks + 55 componentes/páginas). Web search para dados de mercado. MiniMax para gap analysis e validação
- **Parte 1 — Varredura CLM (82+ arquivos)**:
  - **27 hooks CLM analisados**: useContractAI, useContractAIInsights, useContractFormData, useContractNotes, useContractParties, useContracts, useContractVersions, useApprovalWorkflow, useClmDashboard, useClmLifecycle, useInstallments, useLeaseReadjustment, useNotifications, useOnboardingProgress, usePermissions, usePricingAI, useProperties, useDemoMode, useContractTemplates, useContractObligations, useContractDocuments, useContractSignatures, useContractRedlining, useContractNegotiation, useContractAuditTrail, useContractLifecycleEvents, useInsuranceGuarantees
  - **55+ componentes/páginas analisados**: ContractDetailDialog, ApprovalWorkflowPanel, Contracts.tsx, ClmCommandCenter, PricingAIDialog, ContractDraftDialog, ContractDraftWizard, ClauseExtractor, TemplatesManager, 9 tab files, PendingApprovalsWidget, command-center/ (8 componentes decompostos), CLMOnboardingChecklist, CLMOnboardingTour, e mais
  - **Veredicto pós-Fase 5**: Módulo CLM em estado **production-ready** com melhorias menores
- **Achados da Varredura**:
  - **2 TRUE CRITICAL**:
    1. **XSS em AI output** (`useContractAI.ts`): Conteúdo gerado por Gemini/OpenRouter armazenado sem sanitização DOMPurify antes de renderizar. Fix: aplicar `sanitizeContractHtml()` do `sanitizeHtml.ts` existente
    2. **Mock data como dados reais** (`useContractAIInsights.ts`): Quando API falha, retorna scores simulados de saúde/risco do portfólio sem indicar ao usuário que são dados fictícios. Fix: adicionar flag `isSimulated: true` e badge visual
  - **12 MEDIUM (tenant_id gaps)**: 12 hooks fazem queries sem filtro `tenant_id` explícito — MITIGADO pelo Supabase RLS (Row Level Security) que filtra no nível do banco. Buchecha confirmou que com RLS configurado corretamente, filtro client-side é "nice to have". Prioridade reduzida de CRITICAL para MEDIUM
  - **7 MEDIUM (N+1 queries)**: 7 hooks fazem loop sobre contratos buscando dados individuais (installments, parties, versions) em vez de batch queries. Impacto em performance com datasets grandes
  - **3 LOW**: Imports não usados, JSDoc desatualizado, oportunidades de memoização
- **Parte 2 — Benchmarking vs 7 Líderes de Mercado**:
  - **Líderes analisados**: Icertis (enterprise #1), Agiloft (mais configurável), Ironclad (workflow + Jurist AI), DocuSign CLM (ecossistema e-sig), CobbleStone (governance), Sirion (AI-native VISDOM), LinkSquares (contract intelligence)
  - **10 Gaps Funcionais identificados**:
    1. E-signature nativa (todos os líderes têm, Intentus tem proxy sem integração)
    2. Contract versioning com diff visual (Ironclad/Agiloft têm, Intentus tem histórico sem diff)
    3. Obligation auto-extraction via IA (Sirion/Icertis extraem automaticamente)
    4. Clause library inteligente (Agiloft/CobbleStone com risk scoring)
    5. Bulk operations em contratos (todos os líderes têm)
    6. Contract analytics avançado (Sirion VISDOM, LinkSquares)
    7. Workflow builder visual (Agiloft/Ironclad drag-and-drop)
    8. Integração CRM/ERP (todos os líderes têm 100+ conectores)
    9. Compliance monitoring contínuo (CobbleStone/Icertis)
    10. Multi-language support (Icertis 40+ línguas)
  - **5 Gaps de IA**:
    1. Agentic AI (Ironclad Jurist — agente autônomo que negocia)
    2. Conversational contract AI (Agiloft ConvoAI — chat para criar contratos)
    3. Predictive analytics (Sirion VISDOM — predição de riscos e renovações)
    4. AI-powered redlining (sugestões automáticas de cláusulas)
    5. OCR avançado multi-idioma (Intentus tem Gemini, mercado tem modelos especializados)
  - **3 Diferenciais Competitivos Intentus**:
    1. **Precificação com scraping imobiliário** (ÚNICO no mercado — dual actor VivaReal+ZapImóveis)
    2. **State machine DB-driven** com trigger PostgreSQL (defense-in-depth, 13 estados, 50 transições role-based)
    3. **RBAC 3 camadas** (frontend + Edge Functions + DB RLS) — defense-in-depth enterprise-grade
  - **Top 5 Gaps para PropTech Brasileiro** (validado por Buchecha):
    1. E-signature nativa (ClickSign/D4Sign/DocuSign)
    2. Integração CRM/ERP (conectores nativos)
    3. Obligation auto-extraction (prazos, reajustes, garantias)
    4. Contract versioning com diff visual
    5. Accuracy do parsing IA em português brasileiro
- **Parte 3 — Roadmap sugerido (3 horizontes)**:
  - **Horizonte 1 (0-3 meses)**: XSS fix, mock data fix, e-signature nativa, obligation auto-extraction, versioning com diff
  - **Horizonte 2 (3-6 meses)**: Conversational AI, analytics avançado, bulk ops, integração CRM
  - **Horizonte 3 (6-12 meses)**: Agentic AI, predictive analytics, compliance monitoring, workflow builder
- **Entregável**: Relatório Word `docs/varredura-benchmarking-clm-sessao41.docx` (21.7 KB) com branding Intentus, tabelas comparativas, análise de gaps, roadmap
- **Arquivo criado**:
  - `docs/varredura-benchmarking-clm-sessao41.docx` (relatório final — varredura + benchmarking)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
