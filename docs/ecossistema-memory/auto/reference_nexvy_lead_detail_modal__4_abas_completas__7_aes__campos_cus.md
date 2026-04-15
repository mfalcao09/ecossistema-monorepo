---
name: Nexvy Lead Detail Modal — 4 abas completas + 7 ações + campos customizados
description: Nexvy Lead Detail Modal — 4 abas completas + 7 ações + campos customizados
type: reference
project: erp
tags: ["nexvy", "atendimento", "crm", "kanban", "lead-modal", "schema"]
success_score: 0.95
supabase_id: 2fce2adc-0b3d-4231-8794-4bd89d4548a2
created_at: 2026-04-13 02:29:10.337731+00
updated_at: 2026-04-13 06:04:16.555266+00
---

Modal de detalhes do lead (card do kanban). Layout 2 colunas.

PAINEL ESQUERDO (~33%):
- Avatar + nome + 7 ícones com tooltip: Ver Conversa | Marcar não lido | Ligar | Selecionar agente | Editar contato | Trocar responsável | Transferir de Pipeline
- Tags section: chips + "+ Adicionar tag"
- Pipeline: Funil / Etapa / Valor / Status ("Aberto" badge)
- Informações: campos padrão + "+ Adicionar campo" → pair Nome/Valor inline com ✓/✗ → tabela contact_custom_fields

PAINEL DIREITO 4 ABAS:
1. Negócios: deal selector dropdown + barra de progresso por etapas (etapa atual = azul #345EF3) + "Cadência de tarefas" (atividades por coluna) → stage_task_cadences
2. Atividades: form com Tipo(dropdown Lembrete), Responsável, Assunto, Agendar para(datetime), Duração(min=30), anexo, rich text (B/I/U/lists) → deal_activities
3. Histórico: log imutável "Histórico de eventos", filtro "Todos", tipos: "Transferência de Etapa" (ex: "ATENDIMENTOS-GERAL -> SECRETARIA para ATENDIMENTOS-GERAL -> AGUARDANDO") e "Ticket Transferido" → deal_history_events
4. Notas: textarea livre + anexo + send → deal_notes

Novas tabelas: deal_activities, deal_history_events, deal_notes, contact_custom_fields, stage_task_cadences
