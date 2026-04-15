/**
 * ParcelamentoEmbargos.tsx — Embargos Ambientais (Bloco H Sprint 3)
 *
 * Ferramentas de consulta a restrições ambientais:
 *   - Embargos IBAMA — Áreas embargadas (US-126)
 *   - Unidades de Conservação ICMBio
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import {
  ShieldAlert,
  TreePine,
  Loader2,
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useCheckIbamaEmbargoes,
  useCheckICMBioEmbargoes,
} from "@/hooks/useEnvironmentalEmbargoes";
import type {
  CheckIbamaResult,
  IbamaEmbargoItem,
  CheckICMBioResult,
  ICMBioUCItem,
} from "@/lib/parcelamento/environmental-embargoes-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    city?: string;
    state?: string;
    centroid?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riscoColor(risco: string): string {
  switch (risco) {
    case "critico": return "bg-red-100 text-red-800 border-red-200";
    case "alto": return "bg-orange-100 text-orange-800 border-orange-200";
    case "moderado": return "bg-amber-100 text-amber-800 border-amber-200";
    case "baixo": return "bg-green-100 text-green-800 border-green-200";
    default: return "bg-gray-100 text-gray-800";
  }
}

function situacaoIcon(situacao: string) {
  switch (situacao) {
    case "vigente": return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    case "suspenso": return <Info className="w-3.5 h-3.5 text-amber-500" />;
    case "anulado": return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    default: return <Info className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function impactoColor(impacto?: string): string {
  switch (impacto) {
    case "bloqueante": return "bg-red-100 text-red-800";
    case "restritivo": return "bg-amber-100 text-amber-800";
    case "informativo": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function parseCentroid(centroid: string | null | undefined): { lat: number; lng: number } | null {
  if (!centroid) return null;
  try {
    const parsed = JSON.parse(centroid);
    if (parsed?.coordinates?.length === 2) {
      return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// ToolCard wrapper
// ---------------------------------------------------------------------------

function ToolCard({
  icon: Icon,
  title,
  description,
  children,
  onFetch,
  isLoading,
  hasResult,
  risco,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onFetch: () => void;
  isLoading: boolean;
  hasResult: boolean;
  risco?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-50">
            <Icon className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              {risco && <Badge className={riscoColor(risco)}>Risco {risco}</Badge>}
            </div>
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
          {hasResult ? "Atualizar" : "Verificar"}
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IBAMA Section
// ---------------------------------------------------------------------------

function IbamaSection({ project }: Props) {
  const [search, setSearch] = useState(project.city || "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const checkIbama = useCheckIbamaEmbargoes();
  const result = checkIbama.data as CheckIbamaResult | undefined;
  const embargos = result?.data?.embargos || [];
  const risco = result?.data?.risco;

  const coords = parseCentroid(project.centroid);

  const handleFetch = () => {
    checkIbama.mutate({
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      municipio: search || undefined,
      uf: project.state || undefined,
      raio_busca_km: 15,
    });
  };

  return (
    <ToolCard
      icon={ShieldAlert}
      title="Embargos IBAMA"
      description="Consulta de áreas embargadas pelo IBAMA — autuações ambientais vigentes"
      onFetch={handleFetch}
      isLoading={checkIbama.isPending}
      hasResult={embargos.length > 0 || !!result}
      risco={risco}
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

      {checkIbama.isError && (
        <p className="text-xs text-red-500 mb-2">{checkIbama.error?.message}</p>
      )}

      {result && embargos.length === 0 && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-700">Nenhum embargo encontrado</p>
          <p className="text-xs text-gray-400 mt-1">{result.data?.resumo}</p>
        </div>
      )}

      {!result && !checkIbama.isPending && (
        <div className="text-center text-gray-400 py-8">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em Verificar para consultar embargos IBAMA</p>
        </div>
      )}

      {embargos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 mb-2">{result?.data?.resumo}</p>
          {embargos.map((emb: IbamaEmbargoItem) => (
            <div key={emb.id} className="rounded-lg border border-gray-100 bg-gray-50">
              <button
                onClick={() => setExpanded(expanded === emb.id ? null : emb.id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  {situacaoIcon(emb.situacao)}
                  <div>
                    <span className="text-xs font-medium text-gray-900">{emb.numero_auto}</span>
                    {emb.distancia_km != null && (
                      <span className="text-[10px] text-gray-400 ml-2">{emb.distancia_km} km</span>
                    )}
                  </div>
                </div>
                {expanded === emb.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded === emb.id && (
                <div className="px-3 pb-3 text-xs space-y-1">
                  <p><span className="text-gray-500">Local:</span> {emb.municipio}/{emb.uf}</p>
                  <p><span className="text-gray-500">Área:</span> {emb.area_ha} ha</p>
                  <p><span className="text-gray-500">Bioma:</span> {emb.bioma} — {emb.tipo_vegetacao}</p>
                  <p><span className="text-gray-500">Infração:</span> {emb.infração}</p>
                  <p><span className="text-gray-500">Autuado:</span> {emb.nome_autuado}</p>
                  <p><span className="text-gray-500">Data:</span> {new Date(emb.data_embargo).toLocaleDateString("pt-BR")}</p>
                  <Badge className={emb.situacao === "vigente" ? "bg-red-100 text-red-800" : emb.situacao === "suspenso" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>
                    {emb.situacao.charAt(0).toUpperCase() + emb.situacao.slice(1)}
                  </Badge>
                </div>
              )}
            </div>
          ))}
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Fonte: {result?.data?.fonte}
          </p>
        </div>
      )}
    </ToolCard>
  );
}

// ---------------------------------------------------------------------------
// ICMBio Section
// ---------------------------------------------------------------------------

function ICMBioSection({ project }: Props) {
  const [search, setSearch] = useState(project.city || "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const checkICMBio = useCheckICMBioEmbargoes();
  const result = checkICMBio.data as CheckICMBioResult | undefined;
  const ucs = result?.data?.unidades_conservacao || [];
  const risco = result?.data?.risco;

  const coords = parseCentroid(project.centroid);

  const handleFetch = () => {
    checkICMBio.mutate({
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      municipio: search || undefined,
      uf: project.state || undefined,
      raio_busca_km: 20,
    });
  };

  return (
    <ToolCard
      icon={TreePine}
      title="Unidades de Conservação (ICMBio)"
      description="Verificação de sobreposição com UCs — Proteção Integral e Uso Sustentável"
      onFetch={handleFetch}
      isLoading={checkICMBio.isPending}
      hasResult={ucs.length > 0 || !!result}
      risco={risco}
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

      {result && ucs.length === 0 && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-700">Nenhuma UC próxima</p>
          <p className="text-xs text-gray-400 mt-1">{result.data?.resumo}</p>
        </div>
      )}

      {!result && !checkICMBio.isPending && (
        <div className="text-center text-gray-400 py-8">
          <TreePine className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clique em Verificar para consultar UCs do ICMBio</p>
        </div>
      )}

      {ucs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 mb-2">{result?.data?.resumo}</p>
          {ucs.map((uc: ICMBioUCItem) => (
            <div key={uc.id} className="rounded-lg border border-gray-100 bg-gray-50">
              <button
                onClick={() => setExpanded(expanded === uc.id ? null : uc.id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <TreePine className={`w-3.5 h-3.5 ${uc.grupo === "proteção_integral" ? "text-red-500" : "text-amber-500"}`} />
                  <div>
                    <span className="text-xs font-medium text-gray-900">{uc.nome}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {uc.impacto && <Badge className={impactoColor(uc.impacto)}>{uc.impacto}</Badge>}
                      {uc.distancia_km != null && <span className="text-[10px] text-gray-400">{uc.distancia_km} km</span>}
                    </div>
                  </div>
                </div>
                {expanded === uc.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded === uc.id && (
                <div className="px-3 pb-3 text-xs space-y-1">
                  <p><span className="text-gray-500">Categoria:</span> {uc.categoria}</p>
                  <p><span className="text-gray-500">Grupo:</span> {uc.grupo === "proteção_integral" ? "Proteção Integral" : "Uso Sustentável"}</p>
                  <p><span className="text-gray-500">Área:</span> {uc.area_ha.toLocaleString("pt-BR")} ha</p>
                  <p><span className="text-gray-500">Zona amortecimento:</span> {uc.zona_amortecimento_km} km</p>
                  <p><span className="text-gray-500">Ato legal:</span> {uc.ato_legal}</p>
                  <p><span className="text-gray-500">Plano de manejo:</span> {uc.plano_manejo ? "Sim" : "Não"}</p>
                  <div className="mt-1 p-2 rounded bg-amber-50 border border-amber-100">
                    <p className="text-[11px] text-amber-800">{uc.restricoes}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Fonte: {result?.data?.fonte}
          </p>
        </div>
      )}
    </ToolCard>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoEmbargos({ project }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-semibold text-gray-900">Embargos e Restrições Ambientais</h2>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Verificação de embargos IBAMA e sobreposição com Unidades de Conservação ICMBio na região do empreendimento.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IbamaSection project={project} />
        <ICMBioSection project={project} />
      </div>
    </div>
  );
}
