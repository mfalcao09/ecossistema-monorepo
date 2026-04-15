# Sessão 73 — Plano CRM IA-Native: Redesenho Completo do Módulo Comercial (15/03/2026)

- **Objetivo**: Replanejar completamente o CRM para cobrir TODAS as funcionalidades necessárias (47 features em 8 categorias), com IA como BASE do sistema. Marcelo enviou 30+ screenshots do Pipedrive Premium como inspiração
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Análise do módulo CRM atual (82+ arquivos) + benchmarking sessão 46 + screenshots Pipedrive + consulta MiniMax com thinking=true
- **Decisão do Marcelo**: Cronograma IA-Native original tinha apenas 3 features CRM. Precisa cobrir TODAS as 47 funcionalidades analisadas no benchmarking. Menu "Comercial" → "Comercial (CRM)"
- **47 funcionalidades mapeadas em 8 categorias**:
  1. Gestão de Leads & Captação (6 features): Lead Scoring IA, Captação Multi-Canal, Chatbot IA 24/7, Prospector, Distribuição Inteligente, Detecção Duplicados
  2. Pipeline & Funil (6 features): Multi-Funil Customizável, Cards Customizáveis, Pulse/Feed, Stalled Deals, Deal Forecast, Pipeline Analytics
  3. Automações & Workflows (5 features): Engine Backend Real, Templates, Workflow Visual Builder, Follow-up Inteligente, SLA Engine
  4. Comunicação & Engajamento (5 features): WhatsApp API, Email CRM, Campanhas Nurturing, Conversation Intelligence, Assistente IA Corretores
  5. IA & Analytics (6 features): AI Sales Assistant, Matching Imóvel-Cliente, Relatórios IA Narrativa, Forecasting Receita, ROI por Canal, Win/Loss Analysis
  6. Imobiliário Específico (6 features): Calendário Visitas, Exclusividades IA, Precificação IA (✅), Inadimplência IA (✅), Comissões Splits (✅), Integração Portais BR
  7. Gamificação & Performance (3 features): Metas Inteligentes, Ranking Gamificação, Coaching IA
  8. Mobile & UX (3 features): PWA Mobile-First, Filtros Avançados, Customização Views
- **Status das 47 features**: 3 ✅ (já existem — diferenciais únicos), 12 ⚠️ (parciais), 32 ❌ (novas)
- **Cronograma 4 fases (~514h, ~20 semanas)**:
  - F1 Fundamentos IA-Native (S1-S5, ~134h, 13 itens): Engine Automação + Pipeline + Feed + Lead Scoring + Assistente IA
  - F2 Inteligência & Comunicação (S5-S10, ~152h, 11 itens): AI Sales Assistant + Matching + Forecasting + Email + Calendário
  - F3 Captação & Engajamento (S10-S15, ~134h, 9 itens): WhatsApp API + Campanhas + Prospector + Workflow Visual
  - F4 Escala & Diferenciação (S15-S20, ~94h, 4 itens): PWA Mobile + Integrações Portais + Conversation Intelligence + Coaching
- **Mapeamento Pipedrive → Intentus**: 12 features do Pipedrive Premium mapeadas para equivalentes Intentus com fase planejada
- **Entregável**: Relatório Word `docs/plano-crm-ia-native-sessao73.docx` (48KB) com 8 seções, branding Intentus, capa, tabelas comparativas
- **Status**: PARA DISCUSSÃO — Marcelo deve revisar antes de aprovar e iniciar execução
- **Pendente**: Rename "Comercial" → "Comercial (CRM)" no AppSidebar.tsx (após aprovação)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
