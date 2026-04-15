/**
 * ParcelamentoBenchmarks.tsx — Benchmarks de Mercado (Bloco H Sprint 2)
 *
 * Ferramentas de consulta a benchmarks do mercado imobiliário brasileiro:
 *   - SINAPI — Custos de Construção por UF (US-121)
 *   - SECOVI — Preços e Velocidade de Vendas (US-122)
 *   - ABRAINC — Lançamentos e Performance do Setor (US-123)
 *
 * Sessão 142 — Bloco H Sprint 2
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import {
  HardHat,
  TrendingUp,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  MapPin,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Building2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useFetchSinapi,
  useFetchSecovi,
  useFetchAbrainc,
} from "@/hooks/useMarketBenchmarks";
import type {
  SinapiResult,
  SinapiItem,
  SecoviResult,
  SecoviPrecoM2,
  SecoviVelocidadeVendas,
  AbraincResult,
  AbraincLancamento,
  AbraincPerformance,
} from "@/lib/parcelamento/market-benchmarks-types";

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
// Format helpers
// ---------------------------------------------------------------------------

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: number, decimals = 0): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Card wrapper (mesmo padrão de ParcelamentoRegulacoes)
// ---------------------------------------------------------------------------

function ToolCard({
  icon: Icon,
  title,
  description,
  color,
  children,
}: {
  icon: typeof HardHat;
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
// Variation arrow helper
// ---------------------------------------------------------------------------

function VariationBadge({ value }: { value: number }) {
  if (value > 2) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
        <ArrowUpRight className="h-3 w-3" />
        {fmtPct(value)}
      </span>
    );
  }
  if (value < -2) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
        <ArrowDownRight className="h-3 w-3" />
        {fmtPct(value)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500">
      <Minus className="h-3 w-3" />
      {fmtPct(value)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// US-121: SINAPI Card
// ---------------------------------------------------------------------------

function SinapiCard({ project }: Props) {
  const mutation = useFetchSinapi();
  const [result, setResult] = useState<SinapiResult | null>(null);
  const [uf, setUf] = useState(project.state || "SP");
  const [busca, setBusca] = useState("");

  const handleFetch = async () => {
    try {
      const data = await mutation.mutateAsync({
        uf,
        busca: busca || undefined,
        development_id: project.id,
      });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">UF</label>
          <Input
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
            className="w-16 h-8 text-xs"
            placeholder="SP"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-gray-500 mb-1 block">Buscar composição</label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-xs"
            placeholder="ex: terraplanagem, pavimentação, drenagem..."
          />
        </div>
        <Button size="sm" onClick={handleFetch} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Consultar SINAPI
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600">Erro: {mutation.error?.message}</p>
      )}

      {result && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                <MapPin className="h-3 w-3 mr-0.5" />
                {result.uf}
              </Badge>
              <Badge variant="outline" className="text-[10px]">Ref: {result.referencia}</Badge>
            </div>
            <span className="text-xs text-gray-400">{result.total_encontrados} itens</span>
          </div>

          {/* Resumo por grupo */}
          {result.resumo_por_grupo && Object.keys(result.resumo_por_grupo).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(result.resumo_por_grupo).map(([grupo, stats]) => (
                <div key={grupo} className="p-2 rounded-lg bg-blue-50/50 border border-blue-100">
                  <p className="text-[10px] font-medium text-blue-800 truncate">{grupo}</p>
                  <p className="text-sm font-bold text-blue-900">{fmtBRL(stats.media)}</p>
                  <p className="text-[10px] text-blue-600">{fmtBRL(stats.min)} — {fmtBRL(stats.max)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabela de itens */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1.5 pr-2">Código</th>
                  <th className="py-1.5 pr-2">Descrição</th>
                  <th className="py-1.5 pr-2">Un.</th>
                  <th className="py-1.5 pr-2 text-right">Material</th>
                  <th className="py-1.5 pr-2 text-right">Mão&nbsp;de&nbsp;Obra</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {result.itens.map((item: SinapiItem) => (
                  <tr key={item.codigo} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-1.5 pr-2">
                      <Badge variant="outline" className="text-[10px] font-mono">{item.codigo}</Badge>
                    </td>
                    <td className="py-1.5 pr-2 max-w-[250px] truncate" title={item.descricao}>
                      {item.descricao}
                    </td>
                    <td className="py-1.5 pr-2 text-gray-500">{item.unidade}</td>
                    <td className="py-1.5 pr-2 text-right">{fmtBRL(item.custo_material)}</td>
                    <td className="py-1.5 pr-2 text-right">{fmtBRL(item.custo_mao_obra)}</td>
                    <td className="py-1.5 text-right font-semibold">{fmtBRL(item.custo_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nota */}
          <div className="flex gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
            <Info className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-500">{result.nota}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// US-122: SECOVI Card
// ---------------------------------------------------------------------------

function SecoviCard({ project }: Props) {
  const mutation = useFetchSecovi();
  const [result, setResult] = useState<SecoviResult | null>(null);
  const [cidade, setCidade] = useState(project.city || "");
  const [tipoImovel, setTipoImovel] = useState("lote");

  const handleFetch = async () => {
    try {
      const data = await mutation.mutateAsync({
        cidade: cidade || undefined,
        uf: project.state || undefined,
        tipo_imovel: tipoImovel || undefined,
      });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-gray-500 mb-1 block">Cidade</label>
          <Input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="h-8 text-xs"
            placeholder="ex: Piracicaba, Campinas..."
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
          <select
            value={tipoImovel}
            onChange={(e) => setTipoImovel(e.target.value)}
            className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
          >
            <option value="lote">Lote</option>
            <option value="casa">Casa</option>
            <option value="apartamento">Apartamento</option>
            <option value="">Todos</option>
          </select>
        </div>
        <Button size="sm" onClick={handleFetch} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TrendingUp className="h-4 w-4 mr-1" />}
          Consultar SECOVI
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600">Erro: {mutation.error?.message}</p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Ref: {result.referencia}</Badge>
            <Badge variant="outline" className="text-[10px]">{result.total_cidades} cidades</Badge>
          </div>

          {/* Preços por m² */}
          {result.precos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Preço/m² por Cidade
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1.5 pr-2">Cidade</th>
                      <th className="py-1.5 pr-2">Tipo</th>
                      <th className="py-1.5 pr-2 text-right">Mín</th>
                      <th className="py-1.5 pr-2 text-right">Médio</th>
                      <th className="py-1.5 pr-2 text-right">Máx</th>
                      <th className="py-1.5 text-right">Var. 12m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.precos.map((p: SecoviPrecoM2, idx: number) => (
                      <tr key={`${p.cidade}-${p.tipo_imovel}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 pr-2 font-medium">{p.cidade}</td>
                        <td className="py-1.5 pr-2">
                          <Badge variant="outline" className="text-[10px]">{p.tipo_imovel}</Badge>
                        </td>
                        <td className="py-1.5 pr-2 text-right text-gray-500">{fmtBRL(p.preco_m2_min)}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold">{fmtBRL(p.preco_m2_medio)}</td>
                        <td className="py-1.5 pr-2 text-right text-gray-500">{fmtBRL(p.preco_m2_max)}</td>
                        <td className="py-1.5 text-right"><VariationBadge value={p.variacao_12m_pct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Velocidade de Vendas */}
          {result.velocidade_vendas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Velocidade de Vendas (IVV)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {result.velocidade_vendas.map((v: SecoviVelocidadeVendas, idx: number) => (
                  <div key={`${v.cidade}-${v.tipo_imovel}-${idx}`} className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <p className="text-[10px] font-medium text-emerald-800 truncate">{v.cidade}</p>
                    <p className="text-lg font-bold text-emerald-900">{v.ivv_pct}%</p>
                    <div className="flex justify-between text-[10px] text-emerald-600">
                      <span>{v.meses_estoque}m estoque</span>
                      <span>{fmtNum(v.absorcao_liquida)} un/mês</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
            <Info className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-500">{result.nota}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// US-123: ABRAINC Card
// ---------------------------------------------------------------------------

function AbraincCard({ project }: Props) {
  const mutation = useFetchAbrainc();
  const [result, setResult] = useState<AbraincResult | null>(null);
  const [segmento, setSegmento] = useState("loteamento");

  const handleFetch = async () => {
    try {
      const data = await mutation.mutateAsync({
        uf: project.state || undefined,
        segmento: segmento || undefined,
      });
      setResult(data);
    } catch { /* error handled by mutation */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Segmento</label>
          <select
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
          >
            <option value="loteamento">Loteamento</option>
            <option value="MCMV">MCMV</option>
            <option value="MAP">Médio/Alto Padrão</option>
            <option value="">Todos</option>
          </select>
        </div>
        <Button size="sm" onClick={handleFetch} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BarChart3 className="h-4 w-4 mr-1" />}
          Consultar ABRAINC
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600">Erro: {mutation.error?.message}</p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Ref: {result.referencia}</Badge>
            <Badge variant="outline" className="text-[10px]">{result.total_regioes} regiões</Badge>
          </div>

          {/* Lançamentos por região */}
          {result.lancamentos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Lançamentos por Região
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1.5 pr-2">Região</th>
                      <th className="py-1.5 pr-2">Segmento</th>
                      <th className="py-1.5 pr-2 text-right">Lançadas</th>
                      <th className="py-1.5 pr-2 text-right">Vendidas</th>
                      <th className="py-1.5 pr-2 text-right">% Vendido</th>
                      <th className="py-1.5 pr-2 text-right">VGV (Mi)</th>
                      <th className="py-1.5 text-right">Var. 12m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lancamentos.map((l: AbraincLancamento, idx: number) => (
                      <tr key={`${l.regiao}-${l.tipo_programa}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 pr-2 font-medium">{l.regiao}</td>
                        <td className="py-1.5 pr-2">
                          <Badge variant="outline" className="text-[10px]">{l.tipo_programa}</Badge>
                        </td>
                        <td className="py-1.5 pr-2 text-right">{fmtNum(l.unidades_lancadas)}</td>
                        <td className="py-1.5 pr-2 text-right">{fmtNum(l.unidades_vendidas)}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold">{l.pct_vendido}%</td>
                        <td className="py-1.5 pr-2 text-right">{fmtBRL(l.vgv_lancado_milhoes)}M</td>
                        <td className="py-1.5 text-right"><VariationBadge value={l.variacao_12m_pct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Performance por segmento */}
          {result.performance.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" /> Performance por Segmento
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.performance.map((p: AbraincPerformance, idx: number) => (
                  <div key={`${p.segmento}-${idx}`} className="p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                    <p className="text-xs font-semibold text-violet-800 mb-2">{p.segmento}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <div>
                        <span className="text-violet-500">VSO</span>
                        <span className="ml-1 font-bold text-violet-900">{p.vso_pct}%</span>
                      </div>
                      <div>
                        <span className="text-violet-500">Distrato</span>
                        <span className="ml-1 font-bold text-violet-900">{p.taxa_distrato_pct}%</span>
                      </div>
                      <div>
                        <span className="text-violet-500">Margem Bruta</span>
                        <span className="ml-1 font-bold text-violet-900">{p.margem_bruta_pct}%</span>
                      </div>
                      <div>
                        <span className="text-violet-500">Prazo Obra</span>
                        <span className="ml-1 font-bold text-violet-900">{p.prazo_medio_obra_meses}m</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
            <Info className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-500">{result.nota}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component (default export)
// ---------------------------------------------------------------------------

export default function ParcelamentoBenchmarks({ project }: Props) {
  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Benchmarks de Mercado
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Dados de referência do mercado imobiliário brasileiro — SINAPI (custos), SECOVI (preços) e ABRAINC (lançamentos)
        </p>
      </div>

      {/* Tool Cards */}
      <div className="space-y-2">
        <ToolCard
          icon={HardHat}
          title="SINAPI — Custos de Construção"
          description="Catálogo de composições e custos unitários da Caixa Econômica Federal por estado"
          color="bg-blue-600"
        >
          <SinapiCard project={project} />
        </ToolCard>

        <ToolCard
          icon={TrendingUp}
          title="SECOVI — Preços e Velocidade de Vendas"
          description="Preço médio por m², IVV e meses de estoque por cidade e tipo de imóvel"
          color="bg-emerald-600"
        >
          <SecoviCard project={project} />
        </ToolCard>

        <ToolCard
          icon={BarChart3}
          title="ABRAINC — Indicadores do Setor"
          description="Lançamentos, vendas, VSO, distratos e performance por região e segmento"
          color="bg-violet-600"
        >
          <AbraincCard project={project} />
        </ToolCard>
      </div>
    </div>
  );
}
