# Sessão 50 — Expansão ClmSettings.tsx: 7 abas do dialog migradas para página (14/03/2026)

- **Objetivo**: Implementar item 5 do plano UI/UX da sessão 28 — expandir ClmSettings.tsx com as 7 abas completas do CLMSettingsDialog
- **Antes**: Página tinha apenas 77 linhas com ApprovalRulesManager + TemplatesManager + placeholder
- **Depois**: Página com ~530 linhas, 9 tabs verticais em Card com sidebar lateral:
  1. **Campos** — Ocultar/adicionar campos do formulário de contratos (Checkbox grid + CustomItemAdder)
  2. **Aprovação** — Cadeia habilitada, auto-criar, exigir todas, etapas padrão com drag, roles customizados
  3. **Renovação** — Prazo padrão, índice reajuste, alerta dias, aditivo auto, checklist com required flag
  4. **Cláusulas** — Categorias habilitadas, customizadas, aprovação de cláusulas, comentários inline
  5. **Documentos** — Tipos habilitados/customizados, tamanho máximo, aprovação antes de assinar, auto-versionamento
  6. **Obrigações** — Tipos, alertas em dias (badges removíveis), responsável padrão/customizado, recorrência auto
  7. **Auditoria** — Ações rastreadas, customizadas, retenção de logs em dias
  8. **Regras Aprovação** — ApprovalRulesManager (componente existente)
  9. **Templates** — TemplatesManager (componente existente)
- **Layout**: Header com botões Salvar/Restaurar Padrão + Card com grid `[200px_1fr]` (sidebar tabs + conteúdo scrollável)
- **State management**: useClmSettings hook (read/save/reset) + draft local com patch helper + useEffect sync
- **RBAC**: Guard `canManageSettings` mantido (ShieldAlert + redirect)
- **Dialog mantido**: CLMSettingsDialog.tsx preservado como atalho rápido dentro de `/contratos` — sem duplicação de código (dialog continua independente)
- **Build**: 0 erros TypeScript
- **Arquivos modificados** (1):
  - `src/pages/ClmSettings.tsx` — reescrito de 77→~530 linhas com 9 tabs completas
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)

#### Item 6 — Integração de componentes órfãos (14/03/2026)
- **Objetivo**: Avaliar 4 componentes potencialmente órfãos e integrá-los ou removê-los
- **Avaliação** (via Explore agent — imports, funcionalidade, duplicação):
  1. **AIInsightsPanel** (819 linhas) — Funcionalidade única (portfolio insights + risk ranking). Não estava no Command Center
  2. **ReportsPanel** (757 linhas) — Dashboard de relatórios completo. Sem rota própria, sem entrada no sidebar
  3. **ContractFormCustomizationDialog** (184 linhas) — Dialog de customização de campos. NÃO importado em nenhum lugar. 100% duplicado pela tab "Campos" do ClmSettings expandido
  4. **TemplatesManager** (676 linhas) — Já integrado no ClmSettings tab 9. Sem ação necessária
- **3 ações implementadas**:
  1. **AIInsightsPanel → Command Center**: Import + renderização após ObligationsDashboard em `ClmCommandCenter.tsx`
  2. **ReportsPanel → Rota `/contratos/relatorios`**: Criado `ClmRelatorios.tsx` (wrapper), rota em `App.tsx`, item "Relatórios CLM" (BarChart3) no sidebar
  3. **ContractFormCustomizationDialog.tsx DELETADO**: 184 linhas removidas — funcionalidade 100% coberta pela tab Campos do ClmSettings
- **Build**: 0 erros TypeScript
- **Arquivos criados** (1):
  - `src/pages/ClmRelatorios.tsx` — wrapper para ReportsPanel
- **Arquivos modificados** (2):
  - `src/App.tsx` — import + rota `/contratos/relatorios`
  - `src/components/AppSidebar.tsx` — item sidebar "Relatórios CLM" com ícone BarChart3
- **Arquivos deletados** (1):
  - `src/components/contracts/ContractFormCustomizationDialog.tsx` — 184 linhas (órfão + duplicado)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)

#### Fix tela branca /contratos — TDZ error tenantUtils.ts (14/03/2026)
- **Problema**: Marcelo reportou tela completamente branca na página `/contratos` em produção (`app.intentusrealestate.com.br/contratos`)
- **Console error**: `ReferenceError: Cannot access 'de' before initialization` no bundle minificado `index-DQt36HTa.js`
- **Root cause**: `src/lib/tenantUtils.ts` era importado com mixed pattern — 4 arquivos usavam `await import("@/lib/tenantUtils")` (dinâmico) enquanto 80+ arquivos usavam `import { ... } from "@/lib/tenantUtils"` (estático). Isso causava um warning do Vite/Rollup: _"tenantUtils.ts is dynamically imported by [...] but also statically imported by [...]"_. O bundler gerava um chunk onde a variável era acessada antes de ser inicializada (Temporal Dead Zone — TDZ), causando crash em runtime
- **Fix**: Convertidas 7 ocorrências de `await import("@/lib/tenantUtils")` para import estático no topo dos 4 arquivos afetados:
  1. `src/lib/financePipeline.ts` — 1 dynamic import removido
  2. `src/hooks/useRentAdjustments.ts` — 2 dynamic imports removidos
  3. `src/hooks/useTerminations.ts` — 3 dynamic imports removidos
  4. `src/components/users/UsersTab.tsx` — 1 dynamic import removido
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`), 0 erros Vite (`npm run build`), warning de mixed imports eliminado
- **Lição técnica**: Nunca misturar `import()` dinâmico e `import` estático para o MESMO módulo. O Vite/Rollup não consegue resolver a ordem de inicialização corretamente quando um módulo é referenciado das duas formas
- **Arquivos modificados** (4 arquivos):
  - `src/lib/financePipeline.ts` — import estático adicionado, dynamic removido
  - `src/hooks/useRentAdjustments.ts` — import estático adicionado, 2 dynamics removidos
  - `src/hooks/useTerminations.ts` — import estático adicionado, 3 dynamics removidos
  - `src/components/users/UsersTab.tsx` — import estático adicionado, dynamic removido
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
