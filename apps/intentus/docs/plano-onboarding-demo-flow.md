# Plano: Onboarding e Demo Flow do CLM

**Data:** 08/03/2026
**Status:** Planejamento — infraestrutura existente identificada

---

## Estado Atual da Infraestrutura

### Componentes existentes (Fase 4, Épico 3)

1. **`useOnboardingProgress.ts`** — Hook completo com:
   - 8 steps definidos (criar contrato, template, importar, IA, aprovações, relatórios, chatbot, dashboard)
   - Persistência dual: Supabase (`user_onboarding_progress`) + localStorage fallback
   - Auto-complete via `checkAutoComplete(actionType)` — marca steps quando ações acontecem
   - Progresso percentual, reset, tour tracking
   - Realtime sync com `useQueryClient`

2. **`CLMOnboardingChecklist.tsx`** — Widget visual:
   - Header gradiente com cores Intentus (#1A1A2E → #2D2D4E, dourado #e2a93b)
   - Barra de progresso
   - Steps com checkbox visual, ícone, descrição e botão "Fazer agora"
   - Colapsável, dispensável
   - Tela de "Onboarding concluído!" com confete

3. **`CLMOnboardingTour.tsx`** — Tour guiado (componente existe mas precisa validação)

4. **`useShowEmptyState(module)`** — Hook para detectar estado vazio e mostrar conteúdo de onboarding

### O que falta

1. **Integração dos `checkAutoComplete` calls** — Os hooks de ação (criar contrato, rodar IA, etc.) não estão chamando `checkAutoComplete()`. Os steps nunca se marcam automaticamente.

2. **Demo data / sandbox mode** — Não há dados de demonstração pré-carregados para novos usuários experimentarem sem medo.

3. **Fluxo de primeiro acesso** — Não há detecção de "é a primeira vez" para disparar o tour automaticamente.

4. **Tooltips contextuais** — Não há dicas contextuais que apareçam ao passar por uma feature pela primeira vez.

## Plano de Implementação

### Etapa 1: Ativar Auto-Complete dos Steps (2h)

Adicionar `checkAutoComplete()` nos hooks relevantes:

| Step | Hook/Componente | Trigger |
|------|----------------|---------|
| `create_first_contract` | `useContracts.create()` | Após `mutationFn` com sucesso |
| `setup_template` | `useContractTemplates.save()` | Após salvar template |
| `import_contract` | `useContractImportAI.import()` | Após import bem-sucedido |
| `run_ai_analysis` | `usePricingAI.generate()` / `useContractAnalysis` | Após análise concluída |
| `configure_approvals` | `ApprovalWorkflowPanel` save | Após salvar regra de aprovação |
| `explore_reports` | `CLMReportsPage` mount | Ao montar a página de relatórios |
| `use_chatbot` | `CLMCopilotDialog` enviar mensagem | Após enviar primeira mensagem |
| `view_dashboard` | `CLMDashboard` mount | Ao montar o dashboard |

**Implementação:** Cada hook recebe `onboardingProgress.checkAutoComplete('action_type')` no `onSuccess` callback.

### Etapa 2: Tour de Primeiro Acesso (3h)

1. **Detectar primeiro acesso:**
   - Checar `user_onboarding_progress` — se não existir registro, é primeiro acesso
   - Alternativamente: checar se `contracts` count === 0

2. **Tour automatizado (5 passos):**
   - Passo 1: "Bem-vindo ao CLM!" — visão geral da sidebar
   - Passo 2: "Seus contratos ficam aqui" — highlight na lista de contratos
   - Passo 3: "Crie com IA ou manualmente" — highlight no botão + Novo Contrato
   - Passo 4: "O Copilot Jurídico está aqui" — highlight no botão do chatbot
   - Passo 5: "Acompanhe tudo no Dashboard" — highlight no menu Dashboard

3. **Implementação:** Usar biblioteca `react-joyride` (já é padrão no mercado) ou custom com portais + CSS transitions. O componente `CLMOnboardingTour.tsx` já existe — precisa ser validado e conectado.

### Etapa 3: Demo Mode / Sandbox Data (4h)

1. **Seed de demo automático:**
   - Ao detectar primeiro acesso + tenant sem contratos, oferecer: "Quer ver o CLM com dados de exemplo?"
   - Se aceito, inserir via Edge Function:
     - 3-5 contratos de exemplo (locação, venda, administração)
     - 2 templates
     - 1 regra de aprovação
     - Dados de pricing-ai (1 análise simulada)
   - Badge "DEMO" em todos os dados de exemplo
   - Botão "Limpar dados de demonstração" quando quiser começar do zero

2. **Edge Function `clm-seed-demo`:**
   - Recebe `tenant_id`
   - Insere dados de demo com flag `is_demo: true`
   - Retorna contagem de itens criados

### Etapa 4: Tooltips Contextuais (2h)

1. **Tooltips de "primeira vez":**
   - Primeira vez que abre detalhe do contrato → tooltip no botão "Precificação IA"
   - Primeira vez na lista → tooltip no filtro de status
   - Primeira vez nas configurações → tooltip nos provedores de assinatura

2. **Implementação:** `useFirstTimeHint(featureKey)` — localStorage-based, retorna `{ show, dismiss }`. Componente `FirstTimeTooltip` usando `Popover` do shadcn.

### Etapa 5: Empty States Engajadores (1h)

Melhorar os empty states existentes para:
- Ilustração SVG contextual
- Texto convidativo ("Sem contratos? Crie o primeiro em 2 minutos com IA!")
- CTA direto para a ação relevante
- Link para documentação/tutorial

## Prioridade Recomendada

| Etapa | Esforço | Impacto | Prioridade |
|-------|---------|---------|------------|
| 1. Auto-Complete Steps | 2h | Alto — o checklist funciona de verdade | **P0** |
| 2. Tour Primeiro Acesso | 3h | Alto — primeira impressão | **P0** |
| 5. Empty States | 1h | Médio — baixo esforço, bom retorno | **P1** |
| 4. Tooltips Contextuais | 2h | Médio — polimento | **P2** |
| 3. Demo Mode | 4h | Alto — mas complexo | **P2** |

**Total estimado: 12h de desenvolvimento**

## Métricas de Sucesso

- **Activation rate:** % de novos usuários que completam pelo menos 3 dos 8 steps em 7 dias
- **Onboarding completion:** % que completa todos os 8 steps
- **Time to first contract:** Tempo entre primeiro login e criação do primeiro contrato
- **Tour drop-off:** Em qual step do tour os usuários desistem
- **Demo → Real conversion:** % que usam demo e depois criam dados reais

---

*Documento gerado automaticamente — Sessão de 08/03/2026*
