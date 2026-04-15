/**
 * ParcelamentoCenso.tsx — Dados Censitários IBGE (Bloco H Sprint 3)
 *
 * Ferramentas de consulta a dados censitários do IBGE:
 *   - Renda por Setor Censitário (US-124)
 *   - Demografia Municipal
 *   - Dados de Domicílios
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import {
  Users,
  DollarSign,
  Home,
  Loader2,
  Search,
  MapPin,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useFetchCensusIncome,
  useFetchCensusDemographics,
  useFetchCensusHousing,
} from "@/hooks/useIbgeCensus";
import type {
  CensusIncomeResult,
  CensusIncomeItem,
  CensusDemographicsResult,
  CensusDemographicsItem,
  CensusHousingResult,
  CensusHousingItem,
} from "@/lib/parcelamento/ibge-census-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    city?: string;
    state?: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classeColor(classe: string): string {
  switch (classe) {
    case "A": return "bg-emerald-100 text-emerald-800";
    case "B": return "bg-blue-100 text-blue-800";
    case "C": return "bg-amber-100 text-amber-800";
    case "D": return "bg-orange-100 text-orange-800";
    case "E": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatNumber(v: number): string {
  return v.toLocaleString("pt-BR");
}

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// ToolCard wrapper (padrão Benchmarks)
// ---------------------------------------------------------------------------

function ToolCard({
  icon: Icon,
  title,
  description,
  children,
  onFetch,
  isLoading,
  hasResult,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onFetch: () => void;
  isLoading: boolean;
  hasResult: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-50">
            <Icon className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant={hasResult ? "outline" : "default"}
          onClick={onFetch}
          disabled={isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Search className="w-4 h-4 mr-1" />
          )}
          {hasResult ? "Atualizar" : "Consultar"}
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Income Section
// ---------------------------------------------------------------------------

function IncomeSection({ project }: Props) {
  const [search, setSearch] = useState(project.city || "");
  const fetchIncome = useFetchCensusIncome();
  const result = fetchIncome.data as CensusIncomeResult | undefined;
  const items = result?.data?.items || [];

  const handleFetch = () => {
    fetchIncome.mutate({ municipio: search || undefined, uf: project.state || undefined });
  };

  return (
    <ToolCard
      icon={DollarSign}
      title="Renda por Setor Censitário"
      description="Renda domiciliar e per capita do IBGE Censo 2022 — base para Performance Score localizado"
      onFetch={handleFetch}
      isLoading={fetchIncome.isPending}
      hasResult={items.length > 0}
    >
      <div className="mb-3">
        <Input
          placeholder="Buscar município..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          className="text-sm"
        />
      </div>

      {fetchIncome.isError && (
        <p className="text-xs text-red-500 mb-2">{fetchIncome.error?.message}</p>
      )}

      {items.length === 0 && !fetchIncome.isPending && (
        <div className="text-center text-gray-400 py-8">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em Consultar para buscar dados censitários</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item: CensusIncomeItem, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {item.municipio_nome}/{item.uf}
                  </span>
                </div>
                <Badge className={classeColor(item.classe_predominante)}>
                  Classe {item.classe_predominante}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Renda domiciliar média</span>
                  <p className="font-semibold text-gray-900">{formatCurrency(item.renda_domiciliar_media)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Renda per capita</span>
                  <p className="font-semibold text-gray-900">{formatCurrency(item.renda_per_capita)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-gray-500">{">"} 5 SM:</span>
                  <span className="font-medium">{formatPct(item.pct_renda_acima_5sm)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-gray-500">{"<"} 1 SM:</span>
                  <span className="font-medium">{formatPct(item.pct_renda_abaixo_1sm)}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                <Info className="w-3 h-3" />
                <span>{item.fonte} — Setor: {item.setor_codigo}</span>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 text-center">
            Fonte: {result?.data?.fonte} | {result?.data?.total} registro(s)
          </p>
        </div>
      )}
    </ToolCard>
  );
}

// ---------------------------------------------------------------------------
// Demographics Section
// ---------------------------------------------------------------------------

function DemographicsSection({ project }: Props) {
  const [search, setSearch] = useState(project.city || "");
  const fetchDemo = useFetchCensusDemographics();
  const result = fetchDemo.data as CensusDemographicsResult | undefined;
  const items = result?.data?.items || [];

  const handleFetch = () => {
    fetchDemo.mutate({ municipio: search || undefined, uf: project.state || undefined });
  };

  return (
    <ToolCard
      icon={Users}
      title="Demografia Municipal"
      description="População, crescimento, urbanização e estrutura etária do Censo 2022"
      onFetch={handleFetch}
      isLoading={fetchDemo.isPending}
      hasResult={items.length > 0}
    >
      <div className="mb-3">
        <Input
          placeholder="Buscar município..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          className="text-sm"
        />
      </div>

      {items.length === 0 && !fetchDemo.isPending && (
        <div className="text-center text-gray-400 py-8">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em Consultar para dados demográficos</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item: CensusDemographicsItem, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {item.municipio_nome}/{item.uf}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">População</span>
                  <p className="font-semibold text-gray-900">{formatNumber(item.populacao_total)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Densidade</span>
                  <p className="font-semibold text-gray-900">{formatNumber(item.densidade_hab_km2)} hab/km²</p>
                </div>
                <div>
                  <span className="text-gray-500">Cresc. anual</span>
                  <p className={`font-semibold ${item.taxa_crescimento_anual_pct >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {item.taxa_crescimento_anual_pct >= 0 ? "+" : ""}{formatPct(item.taxa_crescimento_anual_pct)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Urbanização</span>
                  <p className="font-semibold text-gray-900">{formatPct(item.populacao_urbana_pct)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Idade média</span>
                  <p className="font-semibold text-gray-900">{item.idade_media.toFixed(1)} anos</p>
                </div>
                <div>
                  <span className="text-gray-500">Índ. envelhecimento</span>
                  <p className="font-semibold text-gray-900">{item.indice_envelhecimento.toFixed(1)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolCard>
  );
}

// ---------------------------------------------------------------------------
// Housing Section
// ---------------------------------------------------------------------------

function HousingSection({ project }: Props) {
  const [search, setSearch] = useState(project.city || "");
  const fetchHousing = useFetchCensusHousing();
  const result = fetchHousing.data as CensusHousingResult | undefined;
  const items = result?.data?.items || [];

  const handleFetch = () => {
    fetchHousing.mutate({ municipio: search || undefined, uf: project.state || undefined });
  };

  return (
    <ToolCard
      icon={Home}
      title="Dados de Domicílios"
      description="Domicílios, infraestrutura, déficit habitacional — base para demanda de lotes"
      onFetch={handleFetch}
      isLoading={fetchHousing.isPending}
      hasResult={items.length > 0}
    >
      <div className="mb-3">
        <Input
          placeholder="Buscar município..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          className="text-sm"
        />
      </div>

      {items.length === 0 && !fetchHousing.isPending && (
        <div className="text-center text-gray-400 py-8">
          <Home className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em Consultar para dados de domicílios</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item: CensusHousingItem, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {item.municipio_nome}/{item.uf}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Total domicílios</span>
                  <p className="font-semibold text-gray-900">{formatNumber(item.total_domicilios)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Média moradores</span>
                  <p className="font-semibold text-gray-900">{item.media_moradores_domicilio.toFixed(1)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Próprios</span>
                  <p className="font-semibold text-green-700">{formatPct(item.domicilios_proprios_pct)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Alugados</span>
                  <p className="font-semibold text-blue-700">{formatPct(item.domicilios_alugados_pct)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Esgoto rede</span>
                  <p className="font-semibold text-gray-900">{formatPct(item.domicilios_com_esgoto_pct)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Déficit habitacional</span>
                  <p className="font-semibold text-orange-700">{formatNumber(item.deficit_habitacional_estimado)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolCard>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoCenso({ project }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-violet-600" />
        <h2 className="text-lg font-semibold text-gray-900">Dados Censitários IBGE</h2>
        <Badge variant="outline" className="text-[10px]">Censo 2022</Badge>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Renda, demografia e domicílios — dados do Censo IBGE para embasar o Performance Score e análise de demanda.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <IncomeSection project={project} />
        <DemographicsSection project={project} />
        <HousingSection project={project} />
      </div>
    </div>
  );
}
