export interface SlaTickets {
  enabled: boolean;
  urgente_hours: number;
  alta_hours: number;
  media_hours: number;
  baixa_hours: number;
}

export interface SlaManutencao {
  enabled: boolean;
  urgente_hours: number;
  alta_hours: number;
  media_hours: number;
  baixa_hours: number;
}

export interface SlaRescisoes {
  enabled: boolean;
  prazo_max_dias: number;
}

export interface SlaRenovacoes {
  enabled: boolean;
  antecedencia_dias: number;
  prazo_finalizacao_dias: number;
}

export interface SlaLeads {
  enabled: boolean;
  primeiro_contato_hours: number;
  followup_dias: number;
}

export interface SlaNegocios {
  enabled: boolean;
  tempo_etapa_dias: number;
  conclusao_total_dias: number;
}

export interface SlaRules {
  tickets: SlaTickets;
  manutencao: SlaManutencao;
  rescisoes: SlaRescisoes;
  renovacoes: SlaRenovacoes;
  leads: SlaLeads;
  negocios: SlaNegocios;
}

export const DEFAULT_SLA_RULES: SlaRules = {
  tickets: {
    enabled: true,
    urgente_hours: 24,
    alta_hours: 48,
    media_hours: 72,
    baixa_hours: 96,
  },
  manutencao: {
    enabled: true,
    urgente_hours: 24,
    alta_hours: 48,
    media_hours: 72,
    baixa_hours: 120,
  },
  rescisoes: {
    enabled: true,
    prazo_max_dias: 60,
  },
  renovacoes: {
    enabled: true,
    antecedencia_dias: 90,
    prazo_finalizacao_dias: 30,
  },
  leads: {
    enabled: true,
    primeiro_contato_hours: 24,
    followup_dias: 7,
  },
  negocios: {
    enabled: true,
    tempo_etapa_dias: 15,
    conclusao_total_dias: 90,
  },
};

export function mergeSlaRules(saved?: Partial<SlaRules> | null): SlaRules {
  if (!saved) return { ...DEFAULT_SLA_RULES };
  return {
    tickets: { ...DEFAULT_SLA_RULES.tickets, ...saved.tickets },
    manutencao: { ...DEFAULT_SLA_RULES.manutencao, ...saved.manutencao },
    rescisoes: { ...DEFAULT_SLA_RULES.rescisoes, ...saved.rescisoes },
    renovacoes: { ...DEFAULT_SLA_RULES.renovacoes, ...saved.renovacoes },
    leads: { ...DEFAULT_SLA_RULES.leads, ...saved.leads },
    negocios: { ...DEFAULT_SLA_RULES.negocios, ...saved.negocios },
  };
}

export function getTicketSlaHours(rules: SlaRules, priority: string): number {
  if (!rules.tickets.enabled) return 0;
  switch (priority) {
    case "urgente": return rules.tickets.urgente_hours;
    case "alta": return rules.tickets.alta_hours;
    case "media": return rules.tickets.media_hours;
    case "baixa": return rules.tickets.baixa_hours;
    default: return rules.tickets.media_hours;
  }
}
