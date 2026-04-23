/**
 * DS Bot — Templates FIC (5 starter flows).
 *
 * Cada template é um grafo válido (nodes + edges + start) que o usuário
 * pode clonar como ponto de partida em /atendimento/ds-bot/novo.
 *
 * NOTA: copy e lógica marcadas como P-140 (design final por Marcelo).
 */

import type { DsBotFlow, DsBotNode, DsBotEdge } from "@/lib/atendimento/ds-bot-types";

export interface BotTemplate {
  slug: string;
  name: string;
  description: string;
  channels: Array<"whatsapp" | "instagram" | "facebook">;
  trigger_type: "keyword" | "new_conversation" | "manual";
  trigger_value?: string;
  flow: DsBotFlow;
  start_node_id: string;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function n<T extends DsBotNode>(node: T): T { return node; }
function e(id: string, source: string, target: string, sourceHandle?: string, label?: string): DsBotEdge {
  return { id, source, target, sourceHandle, label };
}

// ──────────────────────────────────────────────────────────────
// T1 — Qualificação de matrícula
// ──────────────────────────────────────────────────────────────
const qualificacaoMatricula: BotTemplate = {
  slug: "qualificacao-matricula",
  name: "Qualificação — Matrícula",
  description: "Coleta nome, CPF e curso de interesse antes de encaminhar ao humano.",
  channels: ["whatsapp"],
  trigger_type: "keyword",
  trigger_value: "matricula",
  start_node_id: "start",
  flow: {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      n({ id: "start",    type: "trigger",      category: "trigger", position: { x:   0, y: 0 },  data: { label: "Matrícula" } }),
      n({ id: "msg-hi",   type: "bubble_text",  category: "bubble",  position: { x: 220, y: 0 },  data: { text: "Olá! Sou o assistente da FIC. Para te ajudar com matrícula, preciso de alguns dados." } }),
      n({ id: "ask-name", type: "input_text",   category: "input",   position: { x: 440, y: 0 },  data: { question: "Qual seu nome completo?", variable: "nome", required: true } }),
      n({ id: "ask-cpf",  type: "input_text",   category: "input",   position: { x: 660, y: 0 },  data: { question: "Informe seu CPF (só números)", variable: "cpf", required: true, min_length: 11, max_length: 14 } }),
      n({ id: "ask-course", type: "input_button", category: "input", position: { x: 880, y: 0 },  data: {
          question: "Qual curso te interessa?",
          variable: "curso",
          options: [
            { id: "adm",    label: "Administração", value: "Administração" },
            { id: "dir",    label: "Direito",       value: "Direito" },
            { id: "psi",    label: "Psicologia",    value: "Psicologia" },
            { id: "outro",  label: "Outro",         value: "Outro" },
          ],
      } }),
      n({ id: "tag",      type: "contact_add_tag", category: "contact", position: { x: 1100, y: 0 }, data: { tag: "lead-qualificado" } }),
      n({ id: "transfer", type: "attendance_transfer_queue", category: "attendance", position: { x: 1320, y: 0 }, data: { queue_id: "queue:matriculas", note: "Lead qualificado por DS Bot" } }),
      n({ id: "msg-bye",  type: "bubble_text",  category: "bubble",  position: { x: 1540, y: 0 },  data: { text: "Obrigado, {{nome}}! Um consultor de matrícula vai falar com você em instantes." } }),
      n({ id: "end",      type: "flow_end",     category: "flow",    position: { x: 1760, y: 0 },  data: { reason: "qualificado" } }),
    ],
    edges: [
      e("e1", "start",    "msg-hi"),
      e("e2", "msg-hi",   "ask-name"),
      e("e3", "ask-name", "ask-cpf"),
      e("e4", "ask-cpf",  "ask-course"),
      e("e5", "ask-course", "tag"),
      e("e6", "tag",      "transfer"),
      e("e7", "transfer", "msg-bye"),
      e("e8", "msg-bye",  "end"),
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// T2 — Agendamento de visita
// ──────────────────────────────────────────────────────────────
const agendamentoVisita: BotTemplate = {
  slug: "agendamento-visita",
  name: "Agendamento — Visita ao campus",
  description: "Coleta preferência de data e encaminha para a equipe de recepção.",
  channels: ["whatsapp"],
  trigger_type: "keyword",
  trigger_value: "visita",
  start_node_id: "start",
  flow: {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      n({ id: "start",   type: "trigger",     category: "trigger", position: { x:   0, y: 0 }, data: { label: "Visita" } }),
      n({ id: "hi",      type: "bubble_text", category: "bubble",  position: { x: 220, y: 0 }, data: { text: "Agendamento de visita — FIC. Vamos começar!" } }),
      n({ id: "name",    type: "input_text",  category: "input",   position: { x: 440, y: 0 }, data: { question: "Seu nome?", variable: "nome", required: true } }),
      n({ id: "date",    type: "input_date",  category: "input",   position: { x: 660, y: 0 }, data: { question: "Qual data você prefere?", variable: "data_visita", required: true } }),
      n({ id: "tag",     type: "contact_add_tag", category: "contact", position: { x: 880, y: 0 }, data: { tag: "visita-agendada" } }),
      n({ id: "protocol",type: "attendance_open_protocol", category: "attendance", position: { x: 1100, y: 0 }, data: { subject: "Agendamento de visita — {{nome}} em {{data_visita}}", priority: "normal" } }),
      n({ id: "bye",     type: "bubble_text", category: "bubble",  position: { x: 1320, y: 0 }, data: { text: "Recebi seu pedido! Em breve vamos confirmar o agendamento." } }),
      n({ id: "end",     type: "flow_end",    category: "flow",    position: { x: 1540, y: 0 }, data: {} }),
    ],
    edges: [
      e("e1", "start",    "hi"),
      e("e2", "hi",       "name"),
      e("e3", "name",     "date"),
      e("e4", "date",     "tag"),
      e("e5", "tag",      "protocol"),
      e("e6", "protocol", "bye"),
      e("e7", "bye",      "end"),
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// T3 — Consentimento LGPD
// ──────────────────────────────────────────────────────────────
const lgpdConsent: BotTemplate = {
  slug: "lgpd-consent",
  name: "LGPD — Consentimento de dados",
  description: "Captura aceite explícito antes de iniciar atendimento.",
  channels: ["whatsapp"],
  trigger_type: "new_conversation",
  start_node_id: "start",
  flow: {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      n({ id: "start",  type: "trigger",      category: "trigger", position: { x:   0, y: 0 }, data: {} }),
      n({ id: "policy", type: "bubble_text",  category: "bubble",  position: { x: 220, y: 0 }, data: { text: "Para continuar, você autoriza o uso dos seus dados para contato e atendimento, conforme Política de Privacidade FIC?" } }),
      n({ id: "ask",    type: "input_button", category: "input",   position: { x: 440, y: 0 }, data: {
          question: "Você autoriza?",
          variable: "lgpd_aceite",
          options: [
            { id: "yes", label: "Sim, autorizo", value: "yes" },
            { id: "no",  label: "Não autorizo",   value: "no" },
          ],
      } }),
      n({ id: "cond",   type: "conditional",  category: "logic",   position: { x: 660, y: 0 }, data: {
          logic: "AND",
          clauses: [{ left: "var.lgpd_aceite", op: "eq", right: "yes" }],
      } }),
      n({ id: "tag-ok", type: "contact_add_tag", category: "contact", position: { x: 880, y: -120 }, data: { tag: "lgpd-aceito" } }),
      n({ id: "bye-ok", type: "bubble_text",  category: "bubble",  position: { x: 1100, y: -120 }, data: { text: "Obrigado! Em instantes um atendente vai falar com você." } }),
      n({ id: "transfer", type: "attendance_transfer_queue", category: "attendance", position: { x: 1320, y: -120 }, data: { queue_id: "queue:geral" } }),
      n({ id: "end-ok", type: "flow_end", category: "flow", position: { x: 1540, y: -120 }, data: { reason: "aceitou-lgpd" } }),
      n({ id: "bye-no", type: "bubble_text",  category: "bubble",  position: { x: 880,  y: 120 }, data: { text: "Entendido. Se mudar de ideia, é só escrever novamente. Até mais!" } }),
      n({ id: "end-no", type: "flow_end", category: "flow", position: { x: 1100, y: 120 }, data: { reason: "recusou-lgpd" } }),
    ],
    edges: [
      e("e1", "start",  "policy"),
      e("e2", "policy", "ask"),
      e("e3", "ask",    "cond"),
      e("e4", "cond",   "tag-ok",   "true"),
      e("e5", "tag-ok", "bye-ok"),
      e("e6", "bye-ok", "transfer"),
      e("e7", "transfer", "end-ok"),
      e("e8", "cond",   "bye-no",   "false"),
      e("e9", "bye-no", "end-no"),
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// T4 — Coleta de documento
// ──────────────────────────────────────────────────────────────
const coletaDocumento: BotTemplate = {
  slug: "coleta-documento",
  name: "Documentos — Upload de RG/CPF",
  description: "Aluno envia foto/pdf dos documentos; encaminha à secretaria.",
  channels: ["whatsapp"],
  trigger_type: "keyword",
  trigger_value: "documentos",
  start_node_id: "start",
  flow: {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      n({ id: "start",  type: "trigger",     category: "trigger", position: { x:   0, y: 0 }, data: {} }),
      n({ id: "intro",  type: "bubble_text", category: "bubble",  position: { x: 220, y: 0 }, data: { text: "Vou te ajudar com envio de documentos. Por favor, envie:" } }),
      n({ id: "rg",     type: "input_file",  category: "input",   position: { x: 440, y: 0 }, data: { question: "Envie RG (foto ou PDF)", variable: "rg_url", required: true, accept: "image/*,application/pdf", max_mb: 10 } }),
      n({ id: "cpf",    type: "input_file",  category: "input",   position: { x: 660, y: 0 }, data: { question: "Envie CPF (foto ou PDF)", variable: "cpf_url", required: true, accept: "image/*,application/pdf", max_mb: 10 } }),
      n({ id: "tag",    type: "contact_add_tag", category: "contact", position: { x: 880, y: 0 }, data: { tag: "documentos-recebidos" } }),
      n({ id: "proto",  type: "attendance_open_protocol", category: "attendance", position: { x: 1100, y: 0 }, data: { subject: "Documentos recebidos — {{contact.name}}", priority: "normal" } }),
      n({ id: "bye",    type: "bubble_text", category: "bubble",  position: { x: 1320, y: 0 }, data: { text: "Documentos recebidos! A secretaria vai validar em até 2 dias úteis." } }),
      n({ id: "end",    type: "flow_end",    category: "flow",    position: { x: 1540, y: 0 }, data: {} }),
    ],
    edges: [
      e("e1", "start",  "intro"),
      e("e2", "intro",  "rg"),
      e("e3", "rg",     "cpf"),
      e("e4", "cpf",    "tag"),
      e("e5", "tag",    "proto"),
      e("e6", "proto",  "bye"),
      e("e7", "bye",    "end"),
    ],
  },
};

// ──────────────────────────────────────────────────────────────
// T5 — Pós-venda / pesquisa de satisfação
// ──────────────────────────────────────────────────────────────
const posVenda: BotTemplate = {
  slug: "pos-venda",
  name: "Pós-venda — Pesquisa de satisfação",
  description: "NPS simples (0-10) + comentário livre.",
  channels: ["whatsapp"],
  trigger_type: "manual",
  start_node_id: "start",
  flow: {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      n({ id: "start",   type: "trigger",     category: "trigger", position: { x:   0, y: 0 }, data: {} }),
      n({ id: "hi",      type: "bubble_text", category: "bubble",  position: { x: 220, y: 0 }, data: { text: "Oi {{nome}}! Gostaríamos de saber sua opinião sobre o atendimento." } }),
      n({ id: "nps",     type: "input_number",category: "input",   position: { x: 440, y: 0 }, data: { question: "De 0 a 10, o quanto você recomendaria a FIC?", variable: "nps", min: 0, max: 10, required: true } }),
      n({ id: "cond",    type: "conditional", category: "logic",   position: { x: 660, y: 0 }, data: {
          logic: "AND",
          clauses: [{ left: "var.nps", op: "gte", right: 9 }],
      } }),
      n({ id: "promoter", type: "contact_add_tag", category: "contact", position: { x: 880, y: -120 }, data: { tag: "nps-promoter" } }),
      n({ id: "thanks-p", type: "bubble_text",     category: "bubble",  position: { x: 1100, y: -120 }, data: { text: "Que ótimo! 🎉 Obrigado por ser um aluno FIC." } }),
      n({ id: "detractor", type: "contact_add_tag",category: "contact", position: { x: 880, y: 120 }, data: { tag: "nps-detractor" } }),
      n({ id: "ask-why",  type: "input_text",      category: "input",   position: { x: 1100, y: 120 }, data: { question: "Poderia nos contar o que podemos melhorar?", variable: "nps_feedback" } }),
      n({ id: "thanks-d", type: "bubble_text",     category: "bubble",  position: { x: 1320, y: 120 }, data: { text: "Obrigado pelo feedback! Vamos trabalhar nisso." } }),
      n({ id: "proto",    type: "attendance_open_protocol", category: "attendance", position: { x: 1540, y: 120 }, data: { subject: "NPS {{nps}} — {{nome}}", priority: "high" } }),
      n({ id: "end",      type: "flow_end",        category: "flow",    position: { x: 1760, y: 0 }, data: {} }),
    ],
    edges: [
      e("e1", "start",    "hi"),
      e("e2", "hi",       "nps"),
      e("e3", "nps",      "cond"),
      e("e4", "cond",     "promoter",   "true"),
      e("e5", "promoter", "thanks-p"),
      e("e6", "thanks-p", "end"),
      e("e7", "cond",     "detractor",  "false"),
      e("e8", "detractor","ask-why"),
      e("e9", "ask-why",  "thanks-d"),
      e("eA", "thanks-d", "proto"),
      e("eB", "proto",    "end"),
    ],
  },
};

export const FIC_TEMPLATES: BotTemplate[] = [
  qualificacaoMatricula,
  agendamentoVisita,
  lgpdConsent,
  coletaDocumento,
  posVenda,
];

export function getTemplateBySlug(slug: string): BotTemplate | null {
  return FIC_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
