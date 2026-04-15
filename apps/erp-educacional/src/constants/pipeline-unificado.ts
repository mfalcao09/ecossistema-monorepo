/**
 * Pipeline Unificado — Fonte única de verdade para o ERP Educacional FIC
 *
 * REGRA: Todas as telas (Dashboard, Pipeline individual, Processos, etc.)
 * DEVEM usar estas definições para nomear etapas, mapear status e exibir cores.
 * Nunca defina labels de etapas inline em outros arquivos.
 *
 * Pipeline de emissão — Portaria MEC nº 70/2025 · XSD v1.05
 */

// ─── Definição das 6 etapas ───────────────────────────────────────────────────

export interface EtapaPipeline {
  id: string;
  /** Nome completo exibido em telas com espaço */
  label: string;
  /** Nome curto para espaços comprimidos */
  labelCurto: string;
  /** Descrição para tooltips / legendas */
  descricao: string;
  /** Nome do ícone Lucide (importar e associar no componente) */
  iconeNome: string;
  /** Chave de cor Tailwind (usar nos mapas COR_* de cada tela) */
  cor: string;
}

export const ETAPAS_PIPELINE: EtapaPipeline[] = [
  {
    id: "extracao",
    label: "Extração e Dados",
    labelCurto: "Extração",
    descricao: "Upload de documentos, extração por IA e revisão dos dados do diplomando",
    iconeNome: "Sparkles",
    cor: "violet",
  },
  {
    id: "xml",
    label: "XML e Assinatura",
    labelCurto: "XML",
    descricao: "Geração dos XMLs MEC, validação XSD v1.05 e assinatura ICP-A3",
    iconeNome: "FileSignature",
    cor: "blue",
  },
  {
    id: "docs",
    label: "Documentação e Acervo",
    labelCurto: "Docs",
    descricao: "Documentos complementares e acervo acadêmico digital",
    iconeNome: "FileText",
    cor: "amber",
  },
  {
    id: "registro",
    label: "Registro",
    labelCurto: "Registro",
    descricao: "Envio e registro na IES Registradora (UFMS/694)",
    iconeNome: "Building2",
    cor: "indigo",
  },
  {
    id: "rvdd",
    label: "RVDD",
    labelCurto: "RVDD",
    descricao: "Representação Visual do Diploma Digital — geração do PDF oficial",
    iconeNome: "FileCheck2",
    cor: "green",
  },
  {
    id: "publicado",
    label: "Publicado",
    labelCurto: "Publicado",
    descricao: "Diploma publicado no repositório público e acessível ao diplomado",
    iconeNome: "Globe",
    cor: "emerald",
  },
];

// ─── Mapeamento: status do DIPLOMA → índice da etapa (0–5) ──────────────────
// -1 = status de erro (exibir fora do pipeline)

export const DIPLOMA_STATUS_ETAPA: Record<string, number> = {
  // Etapa 0 — Extração e Dados
  rascunho:           0,
  validando_dados:    0,
  preenchido:         0,
  em_extracao:        0,
  aguardando_revisao: 0,

  // Etapa 1 — XML e Assinatura
  gerando_xml:                   1,
  xml_gerado:                    1,
  validando_xsd:                 1,
  aguardando_assinatura_emissora:1,
  em_assinatura:                 1,
  aplicando_carimbo_tempo:       1,
  assinado:                      1,
  xml_com_erros:                 1,
  aguardando_assinatura:         1, // status de processo que pode chegar via diploma

  // Etapa 2 — Documentação e Acervo
  aguardando_documentos:   2,
  gerando_documentos:      2,
  documentos_assinados:    2,
  aguardando_digitalizacao:2,
  acervo_completo:         2,

  // Etapa 3 — Registro
  aguardando_envio_registradora: 3,
  pronto_para_registro:          3,
  enviado_registradora:          3,
  rejeitado_registradora:        3,
  aguardando_registro:           3,
  registrado:                    3,

  // Etapa 4 — RVDD
  gerando_rvdd: 4,
  rvdd_gerado:  4,

  // Etapa 5 — Publicado
  publicado: 5,

  // Erro — fora da sequência normal
  erro: -1,
};

// ─── Mapeamento: status do PROCESSO → índice da etapa (0–5) ─────────────────
// Os processos cobrem as etapas iniciais antes do diploma ser formalmente criado.

export const PROCESSO_STATUS_ETAPA: Record<string, number> = {
  rascunho:             0, // Etapa 0 — Extração e Dados
  em_extracao:          0, // Etapa 0 — Extração e Dados
  aguardando_revisao:   0, // Etapa 0 — Extração e Dados
  aguardando_assinatura:1, // Etapa 1 — XML e Assinatura
  concluido:            5, // Etapa 5 — Publicado (processo encerrado)
  cancelado:           -1, // Cancelado — fora do pipeline
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retorna o índice da etapa (0–5) dado um status de diploma */
export function etapaDoStatus(status: string): number {
  return DIPLOMA_STATUS_ETAPA[status] ?? 0;
}

/** Retorna se o diploma está publicado (todas as etapas concluídas) */
export function isDiplomaConcluido(status: string): boolean {
  return status === "publicado";
}

/** Retorna o label da etapa de um diploma pelo seu status */
export function labelEtapaDoStatus(status: string): string {
  const idx = etapaDoStatus(status);
  if (idx < 0) return "Erro";
  return ETAPAS_PIPELINE[idx]?.label ?? "—";
}
