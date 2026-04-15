import { CheckCircle2, XCircle, ChevronRight, FileText, Building2, Calendar } from "lucide-react"
import type { TipoDocDigital } from "@/types/documentos-digitais"
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais"

interface DiplomaCardProps {
  diploma: {
    id: string
    tipo: TipoDocDigital
    titulo: string
    numero_documento: string | null
    assinado_em: string | null
    publicado_em: string | null
    ies_nome: string | null
    codigo_verificacao: string
    url_verificacao: string | null
  }
  /** Callback chamado ao clicar em "Ver detalhes completos" — abre dialog em vez de navegar */
  onVerDetalhes?: (codigoVerificacao: string) => void
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—"
  // Fix timezone: extraímos YYYY-MM-DD e usamos T12:00:00 para evitar recuo de 1 dia em UTC-3
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  const safe = match ? `${match[1]}T12:00:00` : iso
  return new Date(safe).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export default function DiplomaCardPublico({ diploma, onVerDetalhes }: DiplomaCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header com tipo */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
              {TIPO_DOC_LABELS[diploma.tipo] || diploma.tipo}
            </span>
          </div>
          {/* Status badge */}
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Válido</span>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="px-5 py-4 space-y-3">
        {/* Título do diploma */}
        <h3 className="text-base font-semibold text-slate-800 leading-snug">
          {diploma.titulo}
        </h3>

        {diploma.numero_documento && (
          <p className="text-xs text-slate-500">
            Nº {diploma.numero_documento}
          </p>
        )}

        {/* Instituição */}
        {diploma.ies_nome && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{diploma.ies_nome}</span>
          </div>
        )}

        {/* Datas */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {diploma.assinado_em && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>Assinado digitalmente</span>
            </div>
          )}
          {diploma.publicado_em && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Publicado em {formatarData(diploma.publicado_em)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer com botão */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
        <button
          type="button"
          onClick={() => onVerDetalhes?.(diploma.codigo_verificacao)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors group"
        >
          Ver detalhes completos
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  )
}
