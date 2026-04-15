---
name: C-Suite IA completo — 8 diretores com prompts de produção
description: C-Suite IA completo — 8 diretores com prompts de produção
type: decision
project: ecosystem
tags: ["managed-agents", "claudinho", "c-suite", "orquestrador", "prompts"]
success_score: 0.95
supabase_id: e49b2481-9ff9-4c94-bd9b-91cc97bc98e2
created_at: 2026-04-15 02:09:06.300246+00
updated_at: 2026-04-15 02:09:06.300246+00
---

claudinho_orchestrator.py expandido de 650 → 1541 linhas.

Diretores com prompts mínimos (inline) → prompts completos (funções dedicadas):
• CMO-IA: 5 negócios × tom de voz × 10 skills × canais por negócio × KPIs de marketing
• CSO-IA: funil por negócio × processo comercial 8 etapas × Apollo/Common Room × KPIs SaaS
• CLO-IA: 5 domínios jurídicos × processo de entrega 7 passos × limite: Marcelo advoga/assina
• COO-IA: novo diretor adicionado × automação N8N/Trigger.dev × protocolo 7 etapas × scheduled tasks

Infraestrutura:
• AgentManager.update_all(): re-sincroniza prompts sem recriar agents
• --update-agents: CLI flag para re-sync
• --show-prompt-of <alias>: inspecionar prompt de qualquer diretor
• callable_agents comentado agora tem os 8 diretores (aguardando Research Preview)

Commit: 49d13f6 em branch main
