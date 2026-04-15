# Sessão 25 — Sistema de notificações automáticas (4 etapas)

- **Diagnóstico**: Sistema de notificações tinha infraestrutura completa (hook, UI, tabela, realtime) mas 4 gaps:
  1. Zero triggers automáticos no CLM (createNotification() existia mas nunca era chamado)
  2. NotificationCenter (componente rico, 348 linhas) não usado — AppLayout usava NotificationBell (simples, 90 linhas)
  3. Preferências vazias no primeiro acesso (sem seed automático)
  4. Sem feedback visual de nova notificação (toast)
- **Etapa 1 — 10 triggers automáticos** (via createNotification fire-and-forget):
  - Contracts.tsx (criação), AIContractImportDialog (importação IA), ContractDraftDialog (minuta)
  - ContractDraftWizard (wizard), PricingAIDialog (precificação), ClauseExtractor (cláusulas)
  - ApprovalWorkflowPanel (3 notifs: solicitação, aprovação, rejeição)
  - RenovacaoRealizadaDialog (renovação), ContractInstallments (pagamento), AIInsightsPanel (insights)
- **Etapa 2**: Substituição de NotificationBell → NotificationCenter no AppLayout
- **Etapa 3**: Seed automático de 7 categorias de preferência (useEffect + useRef guard + upsert)
- **Etapa 4 — UX**: Toast via sonner no realtime INSERT, getNotificationLink() expandido (+4 tipos), animação pulse/wiggle no sino
- **Build**: 0 erros TypeScript
- **Arquivos alterados**: AppLayout.tsx, useNotifications.ts, NotificationPreferences.tsx, NotificationCenter.tsx + 10 componentes CLM
