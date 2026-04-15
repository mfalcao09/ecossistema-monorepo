/**
 * Parcelamento de Solo — Análise Financeira (8 abas)
 * Fase 5 Bloco A — Sprint 1: simulação financeira funcional + gráficos recharts
 *
 * Fluxo completo:
 *   1. Usuário clica "Simular" → abre SimularFinanceiroModal
 *   2. Preenche premissas → save_scenario → simulate (EF parcelamento-financial-calc)
 *   3. React Query invalida cache → KPIs + gráficos atualizam automaticamente
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useParcelamentoProject, useParcelamentoFinancial } from "@/hooks/useParcelamentoProjects";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Zap, RefreshCw } from "lucide-react";
import {
  TabFluxoCaixa,
  TabRecebimentos,
  TabBreakEven,
  TabComparacao,
  TabSensibilidade,
  TabPerformanceScore,
  TabEstruturaCapital,
  TabFronteiraEficiente,
} from "@/components/parcelamento/financeiro";
import { SimularFinanceiroModal } from "@/components/parcelamento/financeiro/SimularFinanceiroModal";
import { EditarPremissasModal } from "@/components/parcelamento/financeiro/premissas";
import { useActiveScenarioId, useDeepPremises } from "@/hooks/useSimularFinanceiro";
import { Settings2 } from "lucide-react";

// Configuração das abas
const TABS = [
  { value: "fluxo-caixa",         label: "Fluxo de Caixa",       sprint: 1 },
  { value: "recebimentos",        label: "Recebimentos",          sprint: 1 },
  { value: "break-even",          label: "Break-Even",            sprint: 1 },
  { value: "comparacao",          label: "Comparação",            sprint: 1 },
  { value: "sensibilidade",       label: "Sensibilidade ⭐",      sprint: 2 },
  { value: "performance-score",   label: "Performance Score",     sprint: 1 },
  { value: "estrutura-capital",   label: "Estrutura de Capital",  sprint: 1 },
  { value: "fronteira-eficiente", label: "Fronteira Eficiente",   sprint: 3 },
] as const;

function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  return `R$ ${((value ?? 0) / 1_000).toFixed(0)}k`;
}

export default function ParcelamentoFinanceiro() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(TABS[0].value);
  const [modalOpen, setModalOpen] = useState(false);
  const [premissasOpen, setPremissasOpen] = useState(false);

  const { data: project, isLoading: loadingProject } = useParcelamentoProject(id ?? null);
  const { data: financial, isLoading: loadingFinancial } = useParcelamentoFinancial(id ?? null);
  const { data: activeScenarioId } = useActiveScenarioId(id ?? null);
  const { data: deepPremises } = useDeepPremises(activeScenarioId);

  const isLoading = loadingProject || loadingFinancial;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => navigate(`/parcelamento/${id}`)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {project?.name ?? "Projeto"}
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">Análise Financeira</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Análise Financeira — {project?.name ?? "…"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              8 módulos de análise · VPL · TIR · Break-Even · Monte Carlo
            </p>
          </div>

          <div className="flex items-center gap-2">
            {financial && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-gray-500"
                onClick={() => setPremissasOpen(true)}
                title="Configurar premissas detalhadas (4 abas)"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Premissas
              </Button>
            )}
            {financial && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-gray-500"
                onClick={() => setModalOpen(true)}
                title="Criar novo cenário / recalcular"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Novo cenário
              </Button>
            )}
            <Button
              disabled={isLoading || !id}
              size="sm"
              className="gap-1.5"
              onClick={() => financial ? setPremissasOpen(true) : setModalOpen(true)}
            >
              <Zap className="h-4 w-4" />
              {financial ? "Recalcular" : "Simular"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* ── Conteúdo ── */}
      {!isLoading && (
        <div className="flex-1 overflow-auto">
          {/* KPIs rápidos (só exibe se houver simulação calculada) */}
          {financial?.is_calculated && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-6 pt-5">
              {[
                {
                  label: "VGV Líquido",
                  value: formatCurrency(financial.vgv_total),
                  ok: true,
                },
                {
                  label: "VPL",
                  value: formatCurrency(financial.vpl),
                  ok: (financial.vpl ?? 0) >= 0,
                },
                {
                  label: "TIR Anual",
                  value: financial.tir_anual != null ? `${financial.tir_anual.toFixed(1)}%` : "—",
                  ok: (financial.tir_anual ?? 0) >= 15,
                },
                {
                  label: "Payback",
                  value: financial.payback_meses != null ? `${financial.payback_meses} meses` : "—",
                  ok: (financial.payback_meses ?? 999) <= 48,
                },
                {
                  label: "Performance Score",
                  value: financial.performance_score != null
                    ? `${Math.round(financial.performance_score as unknown as number)}/100`
                    : "—",
                  ok: (financial.performance_score as unknown as number ?? 0) >= 50,
                },
              ].map(({ label, value, ok }) => (
                <div
                  key={label}
                  className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-base font-semibold mt-0.5 ${ok ? "text-gray-900" : "text-red-500"}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Banner para quem ainda não simulou */}
          {!financial && (
            <div className="mx-6 mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Nenhuma simulação calculada ainda
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Clique em "Simular" para calcular VPL, TIR, Fluxo de Caixa e mais — em segundos.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 shrink-0 ml-4"
                onClick={() => setModalOpen(true)}
              >
                <Zap className="h-4 w-4" />
                Simular agora
              </Button>
            </div>
          )}

          {/* ── Tabs ── */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="px-6 pt-5 pb-6"
          >
            <TabsList className="flex h-auto flex-wrap gap-1 bg-gray-100 p-1 rounded-xl mb-2">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 data-[state=active]:font-semibold"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <TabsContent value="fluxo-caixa" className="m-0">
                <TabFluxoCaixa financial={financial} projectName={project?.name} />
              </TabsContent>

              <TabsContent value="recebimentos" className="m-0">
                <TabRecebimentos financial={financial} />
              </TabsContent>

              <TabsContent value="break-even" className="m-0">
                <TabBreakEven
                  financial={financial}
                  totalUnits={project?.total_units}
                />
              </TabsContent>

              <TabsContent value="comparacao" className="m-0">
                <TabComparacao financial={financial} />
              </TabsContent>

              <TabsContent value="sensibilidade" className="m-0">
                <TabSensibilidade financial={financial} />
              </TabsContent>

              <TabsContent value="performance-score" className="m-0">
                <TabPerformanceScore financial={financial} />
              </TabsContent>

              <TabsContent value="estrutura-capital" className="m-0">
                <TabEstruturaCapital financial={financial} />
              </TabsContent>

              <TabsContent value="fronteira-eficiente" className="m-0">
                <TabFronteiraEficiente financial={financial} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}

      {/* ── Modal de simulação (legado — simples) ── */}
      {id && (
        <SimularFinanceiroModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          developmentId={id}
          projectName={project?.name}
          hints={{
            qtd_lotes: project?.total_units,
            preco_medio_lote:
              project?.vgv_estimado && project?.total_units
                ? project.vgv_estimado / project.total_units
                : undefined,
          }}
        />
      )}

      {/* ── Modal de premissas profundas (Bloco F) ── */}
      {id && (
        <EditarPremissasModal
          open={premissasOpen}
          onOpenChange={setPremissasOpen}
          developmentId={id}
          scenarioId={activeScenarioId ?? null}
          projectName={project?.name}
          initialPremises={deepPremises ?? null}
        />
      )}
    </div>
  );
}
