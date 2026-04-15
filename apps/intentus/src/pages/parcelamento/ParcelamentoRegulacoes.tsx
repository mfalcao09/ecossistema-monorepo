/**
 * ParcelamentoRegulacoes.tsx — Regulações Brasil (Bloco H)
 *
 * Ferramentas de regulação e tributos brasileiros para parcelamento de solo:
 *   - ITBI estimado (US-127)
 *   - Outorga Onerosa (US-128)
 *   - Lei do Verde (US-129)
 *   - Validação CNPJ/SPE (US-132)
 *
 * Sessão 141 — Bloco H Sprint 1
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import {
  Receipt,
  Building2,
  TreePine,
  FileSearch,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useCalcItbi,
  useCalcOutorga,
  useCheckLeiVerde,
  useValidateCnpjSpe,
} from "@/hooks/useBrazilRegulations";
import type {
  ItbiResult,
  OutorgaResult,
  LeiVerdeResult,
  LeiVerdeCheckItem,
  CnpjSpeResult,
  CnpjCheckItem,
} from "@/lib/parcelamento/brazil-regulations-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    city?: string;
    state?: string;
    area_total_m2?: number;
  };
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pass: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Conforme" },
  warn: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Atenção" },
  fail: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Não Conforme" },
  pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50", label: "Pendente" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: number, decimals = 0): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------

function ToolCard({
  icon: Icon,
  title,
  description,
  color,
  children,
}: {
  icon: typeof Receipt;
  title: string;
  description: string;
  color: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100 pt-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ITBI Card Content (US-127)
// ---------------------------------------------------------------------------

function ItbiCard({ project }: Props) {
  const mutation = useCalcItbi();
  const [result, setResult] = useState<ItbiResult | null>(null);

  const handleCalc = async () => {
    try {
      const data = await mutation.mutateAsync({ development_id: project.id });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleCalc} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Receipt className="h-4 w-4 mr-1" />}
          Calcular ITBI
        </Button>
        <span className="text-xs text-gray-400">Usa dados do projeto e cenário ativo</span>
      </div>

      {mutation.error && (
        <p className="text-xs text-red-500">{(mutation.error as Error).message}</p>
      )}

      {result && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {result.municipio}/{result.uf}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Alíquota: {result.aliquota_pct}%
            </Badge>
            {result.is_estimate && (
              <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                Estimativa
              </Badge>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">ITBI Terreno</p>
              <p className="text-sm font-semibold text-gray-900">{fmtBRL(result.resumo.itbi_aquisicao_terreno)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">ITBI Vendas (total)</p>
              <p className="text-sm font-semibold text-gray-900">{fmtBRL(result.resumo.itbi_total_vendas_lotes)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-[10px] text-blue-500 uppercase tracking-wide">ITBI Total</p>
              <p className="text-sm font-bold text-blue-700">{fmtBRL(result.resumo.itbi_total)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">% do VGV</p>
              <p className="text-sm font-semibold text-gray-900">{result.resumo.itbi_pct_vgv.toFixed(2)}%</p>
            </div>
          </div>

          {/* Detalhes */}
          <div className="text-xs text-gray-500 space-y-1">
            <p><Scale className="inline h-3 w-3 mr-1" />{result.fonte_legal}</p>
            <p>VGV: {fmtBRL(result.detalhamento.vgv_total)} | {result.detalhamento.qtd_lotes} lotes | ITBI/lote: {fmtBRL(result.detalhamento.itbi_por_lote)}</p>
          </div>

          {/* Dicas */}
          <div className="space-y-1">
            {result.dicas.map((d, i) => (
              <p key={i} className="text-xs text-gray-600 flex gap-1">
                <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                {d}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outorga Card Content (US-128)
// ---------------------------------------------------------------------------

function OutorgaCard({ project }: Props) {
  const mutation = useCalcOutorga();
  const [result, setResult] = useState<OutorgaResult | null>(null);

  const handleCalc = async () => {
    try {
      const data = await mutation.mutateAsync({ development_id: project.id });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleCalc} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Building2 className="h-4 w-4 mr-1" />}
          Calcular Outorga
        </Button>
        <span className="text-xs text-gray-400">Estima OODC com base no Plano Diretor</span>
      </div>

      {mutation.error && (
        <p className="text-xs text-red-500">{(mutation.error as Error).message}</p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{result.municipio}/{result.uf}</Badge>
            <Badge variant="outline" className="text-xs">{result.tipo_empreendimento}</Badge>
            {result.isento && (
              <Badge className="text-xs bg-green-50 text-green-700 border border-green-200">
                Isento de OODC
              </Badge>
            )}
          </div>

          {/* Parâmetros urbanísticos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">CA Básico</p>
              <p className="text-sm font-semibold text-gray-900">{result.parametros_urbanisticos.ca_basico}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">CA Máximo</p>
              <p className="text-sm font-semibold text-gray-900">{result.parametros_urbanisticos.ca_maximo}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">CA Utilizado</p>
              <p className="text-sm font-semibold text-gray-900">{result.parametros_urbanisticos.ca_utilizado}</p>
            </div>
            <div className={`p-2.5 rounded-lg border ${result.isento ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100"}`}>
              <p className={`text-[10px] uppercase tracking-wide ${result.isento ? "text-green-500" : "text-blue-500"}`}>Outorga</p>
              <p className={`text-sm font-bold ${result.isento ? "text-green-700" : "text-blue-700"}`}>
                {result.isento ? "Isento" : fmtBRL(result.calculo.outorga_valor)}
              </p>
            </div>
          </div>

          {result.motivo_isencao && (
            <p className="text-xs text-green-600 flex gap-1">
              <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
              {result.motivo_isencao}
            </p>
          )}

          <p className="text-xs text-gray-500"><Scale className="inline h-3 w-3 mr-1" />{result.fonte_legal}</p>

          {result.dicas.map((d, i) => (
            <p key={i} className="text-xs text-gray-600 flex gap-1">
              <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
              {d}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lei do Verde Card Content (US-129)
// ---------------------------------------------------------------------------

function LeiVerdeCard({ project }: Props) {
  const mutation = useCheckLeiVerde();
  const [result, setResult] = useState<LeiVerdeResult | null>(null);
  const [bioma, setBioma] = useState("cerrado");

  const handleCheck = async () => {
    try {
      const data = await mutation.mutateAsync({ development_id: project.id, bioma });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={bioma}
          onChange={e => setBioma(e.target.value)}
          className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="cerrado">Cerrado</option>
          <option value="mata_atlantica">Mata Atlântica</option>
          <option value="amazonia">Amazônia</option>
          <option value="caatinga">Caatinga</option>
          <option value="pampa">Pampa</option>
          <option value="pantanal">Pantanal</option>
        </select>
        <Button size="sm" onClick={handleCheck} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TreePine className="h-4 w-4 mr-1" />}
          Verificar Lei do Verde
        </Button>
      </div>

      {mutation.error && (
        <p className="text-xs text-red-500">{(mutation.error as Error).message}</p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{result.municipio}/{result.uf}</Badge>
            <Badge variant="outline" className="text-xs">Bioma: {result.bioma}</Badge>
            <Badge variant="outline" className="text-xs">RL: {result.exigencias.reserva_legal_pct}%</Badge>
          </div>

          {/* Estimativas */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-center">
              <p className="text-[10px] text-green-600 uppercase">Área Verde Min.</p>
              <p className="text-xs font-semibold text-green-700">{fmtNum(result.estimativas.area_verde_min_m2)} m²</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-center">
              <p className="text-[10px] text-blue-600 uppercase">Permeável Min.</p>
              <p className="text-xs font-semibold text-blue-700">{fmtNum(result.estimativas.area_permeavel_min_m2)} m²</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-[10px] text-emerald-600 uppercase">Reserva Legal</p>
              <p className="text-xs font-semibold text-emerald-700">{fmtNum(result.estimativas.reserva_legal_min_m2)} m²</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-center">
              <p className="text-[10px] text-amber-600 uppercase">Árvores Viárias</p>
              <p className="text-xs font-semibold text-amber-700">{fmtNum(result.estimativas.arvores_viarias)}</p>
            </div>
            <div className="p-2 rounded-lg bg-lime-50 border border-lime-100 text-center">
              <p className="text-[10px] text-lime-600 uppercase">Mudas Comp.</p>
              <p className="text-xs font-semibold text-lime-700">{fmtNum(result.estimativas.mudas_compensacao)}</p>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-1.5">
            {result.checklist.map((item: LeiVerdeCheckItem, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50/70 border border-gray-100">
                <StatusBadge status={item.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">{item.item}</p>
                  <p className="text-[11px] text-gray-500">Exigido: {item.exigido}</p>
                  <p className="text-[11px] text-gray-500">Atual: {item.atual}</p>
                  {item.recomendacao && (
                    <p className="text-[11px] text-gray-600 mt-0.5">{item.recomendacao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Score resumo */}
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="text-green-600">✓ {result.resumo.pass} conforme</span>
            <span className="text-amber-600">⚠ {result.resumo.warn} atenção</span>
            <span className="text-red-600">✗ {result.resumo.fail} falha</span>
            <span className="text-gray-400">◌ {result.resumo.pending} pendente</span>
          </div>

          <p className="text-xs text-gray-500"><Scale className="inline h-3 w-3 mr-1" />{result.fonte_legal}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CNPJ SPE Card Content (US-132)
// ---------------------------------------------------------------------------

function CnpjSpeCard() {
  const mutation = useValidateCnpjSpe();
  const [cnpj, setCnpj] = useState("");
  const [result, setResult] = useState<CnpjSpeResult | null>(null);

  // Máscara de CNPJ
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 14) v = v.slice(0, 14);
    // Aplica máscara: XX.XXX.XXX/XXXX-XX
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
    setCnpj(v);
  };

  const handleValidate = async () => {
    if (cnpj.replace(/\D/g, "").length !== 14) return;
    try {
      const data = await mutation.mutateAsync({ cnpj });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  const statusColor = result?.resumo?.status_geral === "aprovado" ? "bg-green-50 border-green-200"
    : result?.resumo?.status_geral === "aprovado_com_ressalvas" ? "bg-amber-50 border-amber-200"
    : result?.resumo?.status_geral === "reprovado" ? "bg-red-50 border-red-200" : "";

  const statusLabel = result?.resumo?.status_geral === "aprovado" ? "Aprovado"
    : result?.resumo?.status_geral === "aprovado_com_ressalvas" ? "Aprovado com Ressalvas"
    : result?.resumo?.status_geral === "reprovado" ? "Reprovado" : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="00.000.000/0000-00"
          value={cnpj}
          onChange={handleChange}
          className="w-48 text-sm"
          maxLength={18}
        />
        <Button
          size="sm"
          onClick={handleValidate}
          disabled={mutation.isPending || cnpj.replace(/\D/g, "").length !== 14}
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSearch className="h-4 w-4 mr-1" />}
          Validar CNPJ
        </Button>
      </div>

      {mutation.error && (
        <p className="text-xs text-red-500">{(mutation.error as Error).message}</p>
      )}

      {result && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-mono">{result.cnpj_formatado}</Badge>
            {result.resumo && (
              <Badge className={`text-xs border ${statusColor}`}>
                {statusLabel}
              </Badge>
            )}
            {result.is_spe && (
              <Badge className="text-xs bg-purple-50 text-purple-700 border border-purple-200">SPE</Badge>
            )}
          </div>

          {/* Dados Receita */}
          {result.dados_receita && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-1">
              <p className="text-sm font-semibold text-gray-900">{result.dados_receita.razao_social}</p>
              {result.dados_receita.nome_fantasia && (
                <p className="text-xs text-gray-500">{result.dados_receita.nome_fantasia}</p>
              )}
              <p className="text-xs text-gray-500">
                {result.dados_receita.natureza_juridica} | CNAE: {result.dados_receita.cnae_principal.codigo} — {result.dados_receita.cnae_principal.descricao}
              </p>
              <p className="text-xs text-gray-500">
                Capital Social: R$ {result.dados_receita.capital_social} | Abertura: {result.dados_receita.data_abertura}
              </p>
              <p className="text-xs text-gray-500">
                {result.dados_receita.endereco.logradouro}, {result.dados_receita.endereco.numero} — {result.dados_receita.endereco.municipio}/{result.dados_receita.endereco.uf}
              </p>
            </div>
          )}

          {/* Checks */}
          <div className="space-y-1.5">
            {result.checks.map((c: CnpjCheckItem, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50/70 border border-gray-100">
                <StatusBadge status={c.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">{c.check}</p>
                  <p className="text-[11px] text-gray-500">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dicas */}
          {result.dicas && result.dicas.length > 0 && (
            <div className="space-y-1">
              {result.dicas.map((d, i) => (
                <p key={i} className="text-xs text-gray-600 flex gap-1">
                  <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  {d}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoRegulacoes({ project }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Info className="h-4 w-4 text-gray-400" />
        <p className="text-xs text-gray-500">
          Ferramentas de regulação e tributos brasileiros. Dados baseados em legislação municipal e federal vigente.
        </p>
      </div>

      <ToolCard
        icon={Receipt}
        title="ITBI — Imposto de Transmissão"
        description="Estima o ITBI sobre aquisição do terreno e vendas de lotes (Art. 156 CF/88)"
        color="bg-blue-500"
      >
        <ItbiCard project={project} />
      </ToolCard>

      <ToolCard
        icon={Building2}
        title="Outorga Onerosa do Direito de Construir"
        description="Verifica se há cobrança de OODC conforme Plano Diretor (Estatuto da Cidade Art. 28-31)"
        color="bg-indigo-500"
      >
        <OutorgaCard project={project} />
      </ToolCard>

      <ToolCard
        icon={TreePine}
        title="Lei do Verde — Exigências Ambientais"
        description="Checklist de arborização, permeabilidade, reserva legal e compensação ambiental"
        color="bg-green-600"
      >
        <LeiVerdeCard project={project} />
      </ToolCard>

      <ToolCard
        icon={FileSearch}
        title="Validação CNPJ — Incorporador / SPE"
        description="Consulta Receita Federal e valida situação cadastral, CNAE e natureza jurídica"
        color="bg-purple-500"
      >
        <CnpjSpeCard />
      </ToolCard>
    </div>
  );
}
