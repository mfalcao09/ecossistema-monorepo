# CLM Fase 4 — Documentação de Ativação

## Visão Geral

A Fase 4 do CLM consolida a plataforma como **produto pronto** com auditoria completa, onboarding guiado e testes automatizados.

**Épico 1 (Assinatura Clicksign):** ⚠️ PENDENTE — será configurado separadamente.

---

## Épico 2 — Trilha de Auditoria Completa

### Arquivos criados

| Arquivo | Função |
|---------|--------|
| `src/hooks/useAuditTimeline.ts` | Hook principal: 27 tipos de evento, 8 categorias, filtros, exportação CSV, hash SHA-256 |
| `src/components/contracts/AuditTimelinePanel.tsx` | Painel visual: timeline agrupada por data, filtros, busca, exportação, verificação de integridade |

### Como ativar

1. **Tabela no Supabase** — Execute no SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS contract_audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  description TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_audit_contract_id ON contract_audit_trail(contract_id);
CREATE INDEX idx_audit_event_type ON contract_audit_trail(event_type);
CREATE INDEX idx_audit_event_category ON contract_audit_trail(event_category);
CREATE INDEX idx_audit_created_at ON contract_audit_trail(created_at);

-- RLS
ALTER TABLE contract_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit trail of their contracts"
  ON contract_audit_trail FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM contracts WHERE tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "Users can insert audit events"
  ON contract_audit_trail FOR INSERT
  WITH CHECK (
    contract_id IN (
      SELECT id FROM contracts WHERE tenant_id = auth_tenant_id()
    )
  );
```

2. **Integrar o painel** no componente de detalhes do contrato:

```tsx
import AuditTimelinePanel from "@/components/contracts/AuditTimelinePanel";

// Dentro do componente de detalhes:
<AuditTimelinePanel contractId={contractId} />
```

3. **Registrar eventos** automaticamente em ações do contrato:

```tsx
import { useRegisterAuditEvent } from "@/hooks/useAuditTimeline";

const registerAudit = useRegisterAuditEvent();

// Exemplo: ao criar contrato
registerAudit.mutate({
  contract_id: newContract.id,
  event_type: "contract_created",
  description: `Contrato "${newContract.title}" criado`,
});

// Exemplo: ao alterar status
registerAudit.mutate({
  contract_id: id,
  event_type: "status_changed",
  description: "Status alterado",
  field_name: "status",
  old_value: oldStatus,
  new_value: newStatus,
});
```

---

## Épico 3 — Onboarding Guiado

### Arquivos criados

| Arquivo | Função |
|---------|--------|
| `src/hooks/useOnboardingProgress.ts` | Hook: 8 steps, progresso dual (localStorage + Supabase), auto-complete |
| `src/components/contracts/CLMOnboardingChecklist.tsx` | Widget checklist: barra de progresso, steps com ações, dispensável |
| `src/components/contracts/CLMOnboardingTour.tsx` | Tour step-by-step: 9 telas com dicas, navegação por teclado |
| `src/components/contracts/CLMEmptyStates.tsx` | 5 empty states: Contratos, Templates, Relatórios, IA, Documentos |

### Como ativar

1. **Tabela no Supabase** (opcional — funciona com localStorage como fallback):

```sql
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  module TEXT NOT NULL DEFAULT 'clm',
  completed_steps JSONB DEFAULT '{}',
  progress_percent INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module)
);

ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own onboarding"
  ON user_onboarding_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

2. **Adicionar checklist** na página principal de contratos:

```tsx
import CLMOnboardingChecklist from "@/components/contracts/CLMOnboardingChecklist";

// No topo da listagem de contratos:
<CLMOnboardingChecklist
  onAction={(action) => {
    // Navegar para a ação correspondente
    if (action === "create_contract") navigate("/contracts/new");
    if (action === "open_templates") navigate("/contracts/templates");
    // etc.
  }}
/>
```

3. **Adicionar tour** (acionado na primeira visita):

```tsx
import CLMOnboardingTour from "@/components/contracts/CLMOnboardingTour";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";

const { tourSeen, markTourSeen } = useOnboardingProgress();
const [showTour, setShowTour] = useState(!tourSeen);

<CLMOnboardingTour
  open={showTour}
  onClose={() => {
    setShowTour(false);
    markTourSeen();
  }}
/>
```

4. **Usar empty states** nas listagens vazias:

```tsx
import { ContractsEmptyState } from "@/components/contracts/CLMEmptyStates";
import { useShowEmptyState } from "@/hooks/useOnboardingProgress";

const { showEmptyState } = useShowEmptyState("contracts");

{showEmptyState ? (
  <ContractsEmptyState onAction={handleAction} />
) : (
  <ContractsList />
)}
```

5. **Auto-complete de steps** (registrar quando o usuário faz ações):

```tsx
const { checkAutoComplete } = useOnboardingProgress();

// Quando um contrato é criado:
checkAutoComplete("contract_created");

// Quando a IA é usada:
checkAutoComplete("ai_analysis_run");

// Quando o dashboard é visualizado:
checkAutoComplete("dashboard_viewed");
```

---

## Épico 4 — Testes End-to-End

### Arquivos criados

| Arquivo | Função |
|---------|--------|
| `src/test/phase4/auditTimeline.test.ts` | Testes de auditoria: categorias, mapeamentos, agrupamento, hash SHA-256 |
| `src/test/phase4/onboardingProgress.test.ts` | Testes de onboarding: steps, cálculos de progresso, validação de dados |
| `src/test/phase4/clmIntegration.test.ts` | Testes de integração: integridade dos módulos, consistência entre componentes |

### Como rodar os testes

```bash
# Rodar todos os testes da Fase 4
npx vitest run src/test/phase4/

# Rodar com watch mode
npx vitest src/test/phase4/

# Rodar teste específico
npx vitest run src/test/phase4/auditTimeline.test.ts
```

---

## ⚠️ PENDÊNCIA CRÍTICA — Épico 1: Integração Clicksign

**Status:** ADIADO — configurar manualmente depois.

**O que precisa ser feito:**
1. Criar conta no Clicksign (clicksign.com)
2. Obter API key de produção
3. Configurar variáveis de ambiente no Supabase (CLICKSIGN_API_KEY, CLICKSIGN_ENVIRONMENT)
4. Criar Edge Function `clicksign-webhook` para receber callbacks
5. Integrar botão "Enviar para Assinatura" nos componentes de contrato
6. Mapear status da assinatura para o fluxo de status do contrato

**Prioridade:** ALTA — assinatura digital é requisito para "Produto Pronto".

---

## Instruções de Commit

```bash
# Adicionar os novos arquivos
git add src/hooks/useAuditTimeline.ts
git add src/components/contracts/AuditTimelinePanel.tsx
git add src/hooks/useOnboardingProgress.ts
git add src/components/contracts/CLMOnboardingChecklist.tsx
git add src/components/contracts/CLMOnboardingTour.tsx
git add src/components/contracts/CLMEmptyStates.tsx
git add src/test/phase4/auditTimeline.test.ts
git add src/test/phase4/onboardingProgress.test.ts
git add src/test/phase4/clmIntegration.test.ts
git add CLM_FASE4_ATIVACAO.md

# Commit
git commit -m "feat(clm): Fase 4 — Auditoria, Onboarding Guiado e Testes E2E

- Épico 2: Trilha de auditoria com 27 tipos de evento, 8 categorias, timeline visual, exportação CSV e hash SHA-256
- Épico 3: Onboarding com checklist progressivo (8 steps), tour step-by-step (9 telas), 5 empty states educativos
- Épico 4: 3 arquivos de testes cobrindo auditoria, onboarding e integração entre módulos
- Épico 1 (Clicksign): pendente — documentado para configuração futura"

# Push
git push origin main
```

---

## Resumo dos Entregáveis

| # | Entregável | Status |
|---|-----------|--------|
| 1 | Integração Clicksign | ⚠️ PENDENTE |
| 2 | Trilha de Auditoria Completa (hook + painel) | ✅ PRONTO |
| 3 | Onboarding Guiado (checklist + tour + empty states) | ✅ PRONTO |
| 4 | Testes E2E (3 arquivos, ~40 testes) | ✅ PRONTO |
