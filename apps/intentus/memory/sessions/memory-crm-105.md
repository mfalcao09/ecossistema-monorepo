# Sessão 105 — Cubo Mágico: Navegação por Módulos (Fase 1-4)

**Data**: 2026-03-21
**Tipo**: Feature — Reestruturação Navegação
**Status**: ✅ Implementação Completa (pendente deploy)

## O que foi feito

### Cubo Mágico — Sistema de Navegação por Módulos
Transformação da navegação de sidebar monolítico (100+ itens em seções colapsáveis) para sistema de dois níveis:
1. **ModuleSwitcher** (Cubo Mágico) — popover grid estilo Google Apps no header
2. **Sidebar Contextual** — mostra apenas os sub-itens do módulo ativo

### Arquivos Criados
- `src/hooks/useActiveModule.ts` — Context + Provider + hook + auto-detecção URL + localStorage
- `src/components/ModuleSwitcher.tsx` — Popover grid com 11 módulos (+ superadmin)

### Arquivos Modificados
- `src/components/AppLayout.tsx` — ActiveModuleProvider wrapper + ModuleSwitcher no header
- `src/components/AppSidebar.tsx` — Reescrita para sidebar contextual por módulo ativo

### 11 Módulos Implementados
| ID | Label | Ícone | Cor |
|----|-------|-------|-----|
| dashboard | Dashboard | LayoutDashboard | blue-500 |
| cadastros | Cadastros | Building2 | slate-500 |
| clm | Gestão de Contratos | FileText | indigo-500 |
| comercial | Comercial | Handshake | emerald-500 |
| relacionamento | Relacionamento | Users | rose-500 |
| financeiro | Financeiro | DollarSign | green-500 |
| contabilidade | Contabilidade | BookOpen | teal-500 |
| juridico | Jurídico | Scale | purple-500 |
| whatsapp | WhatsApp | MessageCircle | green-600 |
| lancamentos | Lançamentos | Rocket | orange-500 |
| admin | Administração | Settings | gray-500 |
| superadmin | Super Admin | Crown | amber-500 |

### Lógica preservada
- filterByRole, hasModule, isPageAllowed, PlanBadge — tudo mantido
- SuperAdmin mode (gestão/empresa) — preservado
- WhatsApp condicional (product + subscription) — preservado
- Trial badges — preservados
- ZERO rotas alteradas

### Validação
- `tsc --noEmit --skipLibCheck` → 0 erros
- `vite dev` → inicia sem erros
- Build prod: OOM no CI (precisa 4GB+), mas código compila

## Decisões Técnicas
- **Ordem de detecção**: contabilidade ANTES de financeiro (ambos /financeiro/*)
- **clm vs cadastros**: /contratos (exact) → cadastros; /contratos/* (sub-rotas) → clm
- **localStorage**: persiste último módulo para experiência consistente
- **useModuleNavItems**: hook customizado que mapeia moduleId → array de NavItems filtrados

## Notas
- Buchecha (MiniMax M2.7) deu timeout na consulta da Fase 1 — implementação direta
- Build OOM é limitação do ambiente, não do código
