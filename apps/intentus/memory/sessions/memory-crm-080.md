# Sessão 80 — CRM F1 Item #7: Templates de Automação Pré-Configurados (~10h, P0) (15/03/2026)

- **Objetivo**: Implementar sétimo item da Fase 1 do plano CRM IA-Native (sessão 73): A02 — Templates de Automação Pré-Configurados. Galeria de 11 templates prontos para uso que instanciam automações reais via `useCreateAutomation()` do A01 Engine de Automação (sessão 74)
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). 100% frontend — sem alterações de backend (templates são constantes TypeScript que geram `CreateAutomationParams`)
- **Decisão arquitetural**: Templates como constantes puras no frontend (`AUTOMATION_TEMPLATES` array). Função `templateToParams()` faz deep clone via `JSON.parse(JSON.stringify())` para prevenir mutação. Sem tabela de templates no banco — simplicidade máxima
- **Frontend — `src/hooks/useAutomationTemplates.ts` (CRIADO — ~465 linhas)**:
  - **Types**: `TemplateCategory` (6 valores: follow_up, reativacao, boas_vindas, pipeline, financeiro, produtividade), `AutomationTemplate` interface (id, name, description, category, icon, estimated_impact, params: CreateAutomationParams)
  - **Constants**: `TEMPLATE_CATEGORY_LABELS` (6), `TEMPLATE_CATEGORY_COLORS` (6 com dark mode), `TEMPLATE_CATEGORY_ICONS` (6 lucide-react icons)
  - **11 templates em `AUTOMATION_TEMPLATES`**:
    1. `tpl_followup_pos_visita` (follow_up, simples): Cria tarefa de follow-up após visita realizada
    2. `tpl_followup_proposta` (follow_up, sequência 3 steps): Lembrete 24h + follow-up 72h + escalação 7 dias após proposta
    3. `tpl_reativacao_lead_frio` (reativacao, simples): Notificação para leads sem contato há 10 dias
    4. `tpl_reativacao_deal_perdido` (reativacao, simples): Lembrete de follow-up 30 dias após deal perdido
    5. `tpl_welcome_lead` (boas_vindas, sequência 3 steps): Notificação imediata + e-mail 1h + tarefa 24h para novo lead
    6. `tpl_welcome_deal` (boas_vindas, sequência 2 steps): Notificação + tarefa de próximos passos para novo deal
    7. `tpl_deal_ganho_celebracao` (pipeline, sequência 2 steps): Notificação de celebração + tarefa de pós-venda para deal ganho
    8. `tpl_deal_movido_alerta` (pipeline, simples): Notificação quando deal muda de etapa no pipeline
    9. `tpl_pagamento_atrasado` (financeiro, sequência 3 steps): Notificação imediata + lembrete 3 dias + escalação 7 dias para pagamento atrasado
    10. `tpl_pagamento_recebido` (financeiro, simples): Notificação de confirmação de pagamento recebido
    11. `tpl_aniversario_contrato` (produtividade, simples): Lembrete anual de aniversário de contrato
  - **Helpers**: `getTemplatesByCategory()`, `getAvailableCategories()`, `templateToParams()` (deep clone)
- **Frontend — `src/pages/comercial/CommercialAutomations.tsx` (MODIFICADO — ~920 linhas)**:
  - **ICON_MAP**: Record<string, LucideIcon> com 19 ícones mapeados (string→componente). Resolve icon names dos templates
  - **TemplateGallery**: Sub-componente com category filter pills (color-coded), card grid responsivo, ícone dinâmico via ICON_MAP (fallback Zap), badges de categoria, info de trigger/action/delay, estimated_impact, botão "Aplicar Template"
  - **Tab "Templates"**: Adicionada na TabsList após "Histórico". Renderiza `<TemplateGallery onApply={handleApplyTemplate} isApplying={createAutomation.isPending} />`
  - **handleApplyTemplate**: Chama `createAutomation.mutate(templateToParams(template))` com `onError` toast (fix MiniMax review)
- **MiniMax (Buchecha) code review**: 4 CRITICAL (3 false positives — imports já existentes no contexto do arquivo), 4 WARNING (1 válido: missing onError → fixado), 4 INFO (cosmético)
- **Build**: 0 erros TypeScript ✅
- **Arquivos criados** (1):
  - `src/hooks/useAutomationTemplates.ts` — 11 templates + types + helpers (~465 linhas)
- **Arquivos modificados** (1):
  - `src/pages/comercial/CommercialAutomations.tsx` — TemplateGallery + ICON_MAP + tab Templates + handleApplyTemplate com onError
- **Cronograma CRM IA-Native**: F1 Item #7 ✅ concluído (A02 Templates de Automação). **CRM F1: 7/13 itens concluídos**. Próximo: F1 Item #8
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
