/**
 * Constantes e tipos locais do Command Center
 *
 * Nota: CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS e CONTRACT_LIFECYCLE_PHASES
 * são importados de @/lib/clmApi — NÃO duplicar aqui.
 */

import {
  MessageSquare, FileText, Edit, CheckCircle, Pen, Clock, Shield,
  PenLine, RefreshCw, AlertTriangle, Archive, XCircle, FolderArchive,
} from "lucide-react";

// ============================================================
// Ícones por status de contrato (13 statuses — Phase 4 Enterprise)
// ============================================================
export const STATUS_ICONS: Record<string, React.ElementType> = {
  negociacao: MessageSquare,
  rascunho: FileText,
  em_revisao: Edit,
  em_aprovacao: CheckCircle,
  aguardando_assinatura: Pen,
  vigencia_pendente: Clock,
  ativo: Shield,
  em_alteracao: PenLine,
  renovado: RefreshCw,
  expirado: AlertTriangle,
  encerrado: Archive,
  cancelado: XCircle,
  arquivado: FolderArchive,
};

// ============================================================
// Cores e labels para tipos de contrato (gráfico de pizza)
// ============================================================
export const TYPE_COLORS: Record<string, string> = {
  venda: "#22c55e",
  locacao: "#3b82f6",
  administracao: "#8b5cf6",
  distrato: "#ef4444",
  prestacao_servicos: "#f59e0b",
  obra: "#06b6d4",
  comissao: "#ec4899",
  fornecimento: "#84cc16",
  aditivo: "#f97316",
  cessao: "#6366f1",
  nda: "#64748b",
  exclusividade: "#14b8a6",
};

export const TYPE_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
  distrato: "Distrato",
  prestacao_servicos: "Prest. Serviços",
  obra: "Obra",
  comissao: "Comissão",
  fornecimento: "Fornecimento",
  aditivo: "Aditivo",
  cessao: "Cessão",
  nda: "NDA",
  exclusividade: "Exclusividade",
};

// ============================================================
// Interfaces compartilhadas
// ============================================================
export interface UrgencyItem {
  id?: string;
  title?: string;
  contract_title?: string;
  [key: string]: unknown;
}
