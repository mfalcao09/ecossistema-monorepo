/**
 * Templates pré-configurados para o Engine de Automação Comercial.
 * Cada template é um `CreateAutomationParams` pronto para ser aplicado.
 *
 * Sessão 80 — Pair programming Claudinho + Buchecha (MiniMax M2.5)
 */

import type {
  CreateAutomationParams,
  TriggerEvent,
  ActionType,
  AutomationType,
} from "@/hooks/useCommercialAutomationEngine";

// ============================================================
// Types
// ============================================================

export type TemplateCategory =
  | "follow_up"
  | "reativacao"
  | "boas_vindas"
  | "pipeline"
  | "financeiro"
  | "produtividade";

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string; // lucide-react icon name
  estimated_impact: string;
  params: CreateAutomationParams;
}

// ============================================================
// Constants — Category metadata
// ============================================================

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  follow_up: "Follow-up",
  reativacao: "Reativação",
  boas_vindas: "Boas-vindas",
  pipeline: "Pipeline",
  financeiro: "Financeiro",
  produtividade: "Produtividade",
};

export const TEMPLATE_CATEGORY_COLORS: Record<TemplateCategory, string> = {
  follow_up: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  reativacao:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  boas_vindas:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pipeline:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  financeiro:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  produtividade:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
};

export const TEMPLATE_CATEGORY_ICONS: Record<TemplateCategory, string> = {
  follow_up: "PhoneCall",
  reativacao: "RotateCcw",
  boas_vindas: "PartyPopper",
  pipeline: "GitBranch",
  financeiro: "DollarSign",
  produtividade: "Target",
};

// ============================================================
// Templates — Definições
// ============================================================

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // ── Follow-up ──────────────────────────────────────────────
  {
    id: "tpl_followup_pos_visita",
    name: "Follow-up Pós-Visita",
    description:
      "Cria tarefa de follow-up 24h após uma visita ser realizada. Garante que nenhum lead visitante fique sem retorno.",
    category: "follow_up",
    icon: "PhoneCall",
    estimated_impact: "Aumento de 30% na taxa de conversão pós-visita",
    params: {
      name: "Follow-up Pós-Visita (24h)",
      trigger_event: "visita_realizada" as TriggerEvent,
      delay_days: 1,
      action_type: "tarefa" as ActionType,
      automation_type: "simples" as AutomationType,
      description:
        "Cria uma tarefa de follow-up 24 horas após a visita ser registrada, garantindo retorno rápido ao lead.",
    },
  },
  {
    id: "tpl_followup_proposta",
    name: "Follow-up Pós-Proposta",
    description:
      "Sequência de 3 passos após envio de proposta: lembrete em 2 dias, notificação ao gestor em 5 dias, e tarefa de recontato em 7 dias.",
    category: "follow_up",
    icon: "Mail",
    estimated_impact: "Redução de 40% em propostas sem resposta",
    params: {
      name: "Sequência Follow-up Pós-Proposta",
      trigger_event: "proposta_enviada" as TriggerEvent,
      delay_days: 0,
      action_type: "lembrete" as ActionType,
      automation_type: "sequencia" as AutomationType,
      description:
        "Sequência de 3 passos após envio de proposta: lembrete (2d), notificação gestor (5d), tarefa recontato (7d).",
      steps: [
        {
          step_order: 1,
          delay_minutes: 0,
          action_type: "lembrete" as ActionType,
          action_config: {
            reminder_message:
              "Proposta enviada — agendar retorno com o cliente em 48h",
          },
          is_active: true,
        },
        {
          step_order: 2,
          delay_minutes: 2 * 24 * 60, // 2 dias
          action_type: "notificacao" as ActionType,
          action_config: {
            notification_message:
              "⚠️ Proposta sem retorno há 2 dias. Considere ligar para o cliente.",
            notification_category: "alerta",
          },
          is_active: true,
        },
        {
          step_order: 3,
          delay_minutes: 5 * 24 * 60, // 5 dias
          action_type: "tarefa" as ActionType,
          action_config: {
            task_title: "Recontato urgente — proposta sem resposta há 5 dias",
            task_description:
              "O cliente não respondeu à proposta enviada há 5 dias. Faça contato imediato para não perder a oportunidade.",
          },
          is_active: true,
        },
      ],
    },
  },

  // ── Reativação ─────────────────────────────────────────────
  {
    id: "tpl_reativacao_lead_frio",
    name: "Reativação de Lead Frio",
    description:
      "Quando um lead fica sem contato por X dias, dispara notificação automática para o corretor responsável.",
    category: "reativacao",
    icon: "RotateCcw",
    estimated_impact: "Recuperação de 15-20% dos leads abandonados",
    params: {
      name: "Reativação Lead Frio (7 dias sem contato)",
      trigger_event: "sem_contato_x_dias" as TriggerEvent,
      delay_days: 7,
      action_type: "notificacao" as ActionType,
      automation_type: "simples" as AutomationType,
      description:
        "Notifica o corretor quando um lead fica 7 dias sem nenhum contato registrado. Evita perda por inatividade.",
    },
  },
  {
    id: "tpl_reativacao_deal_perdido",
    name: "Nurturing Pós-Perda",
    description:
      "Quando um deal é marcado como perdido, agenda tarefa de recontato em 30 dias para tentar reativação com nova abordagem.",
    category: "reativacao",
    icon: "Heart",
    estimated_impact: "5-10% de reativação de deals perdidos",
    params: {
      name: "Nurturing Pós-Perda (30 dias)",
      trigger_event: "deal_perdido" as TriggerEvent,
      delay_days: 30,
      action_type: "tarefa" as ActionType,
      automation_type: "simples" as AutomationType,
      description:
        "Cria tarefa de recontato 30 dias após perda do deal. Abordagem: verificar se situação mudou, oferecer condições especiais.",
    },
  },

  // ── Boas-vindas ────────────────────────────────────────────
  {
    id: "tpl_welcome_lead",
    name: "Welcome Sequence — Novo Lead",
    description:
      "Sequência de boas-vindas para leads novos: notificação imediata ao corretor, lembrete de primeiro contato em 1h, e tarefa de qualificação em 24h.",
    category: "boas_vindas",
    icon: "PartyPopper",
    estimated_impact: "Redução de 60% no tempo de primeiro contato",
    params: {
      name: "Welcome Sequence — Novo Lead",
      trigger_event: "lead_criado" as TriggerEvent,
      delay_days: 0,
      action_type: "notificacao" as ActionType,
      automation_type: "sequencia" as AutomationType,
      description:
        "Sequência de boas-vindas em 3 passos: notificação imediata, lembrete 1h, tarefa de qualificação 24h.",
      steps: [
        {
          step_order: 1,
          delay_minutes: 0,
          action_type: "notificacao" as ActionType,
          action_config: {
            notification_message:
              "🎉 Novo lead cadastrado! Faça o primeiro contato o mais rápido possível.",
            notification_category: "alerta",
          },
          is_active: true,
        },
        {
          step_order: 2,
          delay_minutes: 60, // 1 hora
          action_type: "lembrete" as ActionType,
          action_config: {
            reminder_message:
              "⏰ Já entrou em contato com o novo lead? O tempo de resposta é crucial!",
          },
          is_active: true,
        },
        {
          step_order: 3,
          delay_minutes: 24 * 60, // 24 horas
          action_type: "tarefa" as ActionType,
          action_config: {
            task_title: "Qualificar novo lead",
            task_description:
              "Verificar perfil do lead, interesse, orçamento e urgência. Atualizar informações no CRM.",
          },
          is_active: true,
        },
      ],
    },
  },
  {
    id: "tpl_welcome_deal",
    name: "Onboarding de Novo Negócio",
    description:
      "Quando um deal é criado, notifica o responsável e cria tarefa de preparação de documentação.",
    category: "boas_vindas",
    icon: "Briefcase",
    estimated_impact: "Padronização do processo de abertura de negócios",
    params: {
      name: "Onboarding — Novo Negócio",
      trigger_event: "deal_criado" as TriggerEvent,
      delay_days: 0,
      action_type: "notificacao" as ActionType,
      automation_type: "sequencia" as AutomationType,
      description:
        "Ao criar um novo negócio: notificação imediata + tarefa de preparação de documentação em 2h.",
      steps: [
        {
          step_order: 1,
          delay_minutes: 0,
          action_type: "notificacao" as ActionType,
          action_config: {
            notification_message:
              "📋 Novo negócio criado! Revise os dados e prepare a documentação necessária.",
            notification_category: "contrato",
          },
          is_active: true,
        },
        {
          step_order: 2,
          delay_minutes: 120, // 2 horas
          action_type: "tarefa" as ActionType,
          action_config: {
            task_title: "Preparar documentação do negócio",
            task_description:
              "Reunir documentos do cliente, verificar certidões, preparar proposta formal.",
          },
          is_active: true,
        },
      ],
    },
  },

  // ── Pipeline ───────────────────────────────────────────────
  {
    id: "tpl_deal_ganho_celebracao",
    name: "Celebração de Negócio Fechado",
    description:
      "Quando um deal é ganho, notifica toda a equipe e cria tarefa de pós-venda (documentação + handoff).",
    category: "pipeline",
    icon: "Trophy",
    estimated_impact: "Melhoria no moral da equipe e no processo pós-venda",
    params: {
      name: "Celebração + Pós-Venda — Deal Ganho",
      trigger_event: "deal_ganho" as TriggerEvent,
      delay_days: 0,
      action_type: "notificacao" as ActionType,
      automation_type: "sequencia" as AutomationType,
      description:
        "Ao ganhar um deal: notificação celebração + tarefa de pós-venda em 24h.",
      steps: [
        {
          step_order: 1,
          delay_minutes: 0,
          action_type: "notificacao" as ActionType,
          action_config: {
            notification_message:
              "🏆 Negócio fechado com sucesso! Parabéns à equipe! Agora é hora de garantir uma experiência excelente no pós-venda.",
            notification_category: "sistema",
          },
          is_active: true,
        },
        {
          step_order: 2,
          delay_minutes: 24 * 60,
          action_type: "tarefa" as ActionType,
          action_config: {
            task_title: "Checklist pós-venda",
            task_description:
              "1. Confirmar documentação completa\n2. Agendar vistoria\n3. Preparar contrato final\n4. Enviar kit de boas-vindas ao cliente",
          },
          is_active: true,
        },
      ],
    },
  },
  {
    id: "tpl_deal_movido_alerta",
    name: "Alerta de Movimentação no Pipeline",
    description:
      "Quando um deal muda de fase no pipeline, notifica o gestor para acompanhamento e visibilidade.",
    category: "pipeline",
    icon: "ArrowRightLeft",
    estimated_impact: "Visibilidade 100% das movimentações do funil",
    params: {
      name: "Alerta — Deal Movido no Pipeline",
      trigger_event: "deal_movido_pipeline" as TriggerEvent,
      delay_days: 0,
      action_type: "notificacao" as ActionType,
      automation_type: "simples" as AutomationType,
      description:
        "Notifica o gestor sempre que um deal é movido para uma nova fase do pipeline.",
    },
  },

  // ── Financeiro ─────────────────────────────────────────────
  {
    id: "tpl_pagamento_atrasado",
    name: "Cobrança Automática — Pagamento Atrasado",
    description:
      "Sequência de cobrança quando um pagamento atrasa: notificação imediata, lembrete em 3 dias, tarefa de contato formal em 7 dias.",
    category: "financeiro",
    icon: "AlertTriangle",
    estimated_impact: "Redução de 25% no tempo médio de inadimplência",
    params: {
      name: "Sequência Cobrança — Pagamento Atrasado",
      trigger_event: "pagamento_atrasado" as TriggerEvent,
      delay_days: 0,
      action_type: "notificacao" as ActionType,
      automation_type: "sequencia" as AutomationType,
      description:
        "Sequência de cobrança em 3 passos: notificação imediata, lembrete 3d, tarefa contato formal 7d.",
      steps: [
        {
          step_order: 1,
          delay_minutes: 0,
          action_type: "notificacao" as ActionType,
          action_config: {
            notification_message:
              "💰 Pagamento em atraso detectado! Verifique a situação e entre em contato com o cliente.",
            notification_category: "cobranca",
          },
          is_active: true,
        },
        {
          step_order: 2,
          delay_minutes: 3 * 24 * 60,
          action_type: "lembrete" as ActionType,
          action_config: {
            reminder_message:
              "⚠️ Pagamento atrasado há 3 dias. Regularize a situação antes de escalar.",
          },
          is_active: true,
        },
        {
          step_order: 3,
          delay_minutes: 7 * 24 * 60,
          action_type: "tarefa" as ActionType,
          action_config: {
            task_title: "Contato formal — pagamento atrasado há 7 dias",
            task_description:
              "O pagamento está atrasado há 7 dias. Envie notificação formal ao cliente e avalie necessidade de encaminhar ao jurídico.",
          },
          is_active: true,
        },
      ],
    },
  },
  {
    id: "tpl_pagamento_recebido",
    name: "Confirmação de Pagamento Recebido",
    description:
      "Quando um pagamento é recebido, notifica o responsável e registra a confirmação.",
    category: "financeiro",
    icon: "CheckCircle",
    estimated_impact: "Transparência total no fluxo de recebimentos",
    params: {
      name: "Confirmação — Pagamento Recebido",
      trigger_event: "pagamento_recebido" as TriggerEvent,
      delay_days: 0,
      action_type: "notificacao" as ActionType,
      automation_type: "simples" as AutomationType,
      description:
        "Notifica o corretor/gestor quando um pagamento é confirmado. Mantém todos informados em tempo real.",
    },
  },

  // ── Produtividade ──────────────────────────────────────────
  {
    id: "tpl_aniversario_contrato",
    name: "Lembrete de Aniversário de Contrato",
    description:
      "Dispara lembrete quando um contrato completa 12 meses, sinalizando oportunidade de renovação ou upsell.",
    category: "produtividade",
    icon: "Calendar",
    estimated_impact: "Aumento de 20% na taxa de renovação",
    params: {
      name: "Lembrete — Aniversário de Contrato",
      trigger_event: "aniversario_contrato" as TriggerEvent,
      delay_days: 0,
      action_type: "tarefa" as ActionType,
      automation_type: "simples" as AutomationType,
      description:
        "Cria tarefa de acompanhamento no aniversário de 12 meses do contrato. Oportunidade de renovação, upsell ou check-in.",
    },
  },
];

// ============================================================
// Helpers
// ============================================================

/** Retorna templates filtrados por categoria */
export function getTemplatesByCategory(
  category: TemplateCategory,
): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter((t) => t.category === category);
}

/** Retorna todas as categorias únicas presentes nos templates */
export function getAvailableCategories(): TemplateCategory[] {
  const categories = new Set<TemplateCategory>();
  for (const t of AUTOMATION_TEMPLATES) {
    categories.add(t.category);
  }
  return Array.from(categories);
}

/** Converte um template em CreateAutomationParams (clone profundo) */
export function templateToParams(
  template: AutomationTemplate,
): CreateAutomationParams {
  return JSON.parse(JSON.stringify(template.params)) as CreateAutomationParams;
}
