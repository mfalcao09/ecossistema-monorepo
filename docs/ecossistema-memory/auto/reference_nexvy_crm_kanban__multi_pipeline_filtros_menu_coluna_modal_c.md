---
name: Nexvy CRM Kanban — Multi-pipeline, filtros, menu coluna, modal criar negócio
description: Nexvy CRM Kanban — Multi-pipeline, filtros, menu coluna, modal criar negócio
type: reference
project: erp
tags: ["nexvy", "atendimento", "crm", "kanban", "pipeline", "schema"]
success_score: 0.92
supabase_id: 7d4de135-2f9d-4489-aba1-5b4867f52a4e
created_at: 2026-04-13 02:29:34.843781+00
updated_at: 2026-04-13 07:04:18.000624+00
---

Descobertas batch 2 do kanban /business:

MULTI-PIPELINE CONFIRMADO: FIC tem 2 pipelines — "ATENDIMENTOS - GERAL" (171 deals) e "Alunos" + "+ Criar nova pipeline". Tabela pipelines deve ser multi-row desde Sprint 1.

FILTROS do kanban: Tags | Campanhas (→ tabela campaigns) | Filas (dropdown queues) | Período (date range) | "Somente mensagens não lidas" checkbox | "Somente com tarefas pendentes" checkbox

MENU ⋮ por coluna (4 ações): Editar coluna | Transferir negócios | Baixar CSV | Execuções de Automação (→ automation_executions com pipeline_stage_id)

MODAL "Adicionar Coluna": Nome + Cor (paleta ~12 cores predefinidas, não hex livre)

MODAL "Criar Negócio": Lead (busca contato) + Responsável (pré-preenche agente logado) + Valor (R$) + Produto (opcional → tabela products P3)

TOGGLE "Visualizar mensagens": compact vs message_preview — estado local no componente, sem persistência no banco

SEED FIC: 2 pipelines (ATENDIMENTOS-GERAL 4 etapas + Alunos)
