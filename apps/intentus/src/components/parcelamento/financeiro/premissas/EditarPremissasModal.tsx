/**
 * EditarPremissasModal — Modal de Premissas Profundas (Bloco F)
 *
 * 4 abas: Projeto / Vendas / Terreno / Custos
 * Auto-save com debounce de 2s + botão manual "Salvar agora"
 * Botão "Simular" encadeia save → simulate como o modal antigo.
 *
 * Sessão 138 — Claudinho + Buchecha
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Zap,
  Settings2,
  ShoppingCart,
  MapPin,
  Hammer,
  Save,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { parcelamentoQueryKeys } from "@/hooks/useParcelamentoProjects";
import { useSimularFinanceiro } from "@/hooks/useSimularFinanceiro";
import { TabProjeto } from "./TabProjeto";
import { TabVendas } from "./TabVendas";
import { TabTerreno } from "./TabTerreno";
import { TabCustos } from "./TabCustos";
import type {
  DeepPremises,
  ProjectPremises,
  SalesPremises,
  LandPremises,
  CostsPremises,
} from "@/lib/parcelamento/deep-premises-types";
import {
  DEFAULT_DEEP_PREMISES,
  calcVGVBruto,
} from "@/lib/parcelamento/deep-premises-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  developmentId: string;
  scenarioId: string | null;
  projectName?: string;
  /** Premissas existentes (carregadas do banco) */
  initialPremises?: DeepPremises | null;
}

/** Converte DeepPremises → ScenarioFormValues legado para o simulate */
function toScenarioFormValues(dp: DeepPremises) {
  const precoMedioLote = dp.project.area_media_lote_m2 * dp.project.preco_m2;
  return {
    nome: dp.project.nome,
    prazo_obra_meses: dp.project.prazo_obra_meses,
    prazo_comercializacao_meses: dp.project.prazo_comercializacao_meses,
    mes_inicio_vendas: dp.project.mes_inicio_vendas,
    preco_medio_lote: precoMedioLote,
    qtd_lotes: dp.project.total_lotes,
    velocidade_vendas_pct_mes: dp.sales.velocidade_vendas_pct_mes,
    inadimplencia_pct: dp.sales.inadimplencia_pct,
    taxa_desconto_anual_pct: dp.costs.taxa_desconto_anual_pct,
    entrada_pct: dp.sales.entrada_pct,
    parcelas_qtd: dp.sales.parcelas_qtd,
    balao_final_pct: dp.sales.balao_final_pct,
    equity_pct: dp.costs.equity_pct,
    divida_pct: 100 - dp.costs.equity_pct,
    custo_divida_anual_pct: dp.costs.custo_divida_anual_pct,
    regime_tributario: dp.costs.regime_tributario,
    patrimonio_afetacao: dp.costs.patrimonio_afetacao,
    ret_ativo: dp.costs.ret_ativo,
    aliquota_ir_pct: dp.costs.aliquota_ir_pct,
    indice_correcao_mensal_pct: dp.sales.indice_correcao_mensal_pct,
  };
}

export function EditarPremissasModal({
  open,
  onOpenChange,
  developmentId,
  scenarioId,
  projectName,
  initialPremises,
}: Props) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const { mutate: simular, isPending: isSimulating } = useSimularFinanceiro();

  // ── State ──
  const [premises, setPremises] = useState<DeepPremises>(
    initialPremises ?? DEFAULT_DEEP_PREMISES
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState("projeto");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset ao abrir com novas premissas
  useEffect(() => {
    if (open && initialPremises) {
      setPremises(initialPremises);
      setIsDirty(false);
      setLastSaved(null);
    }
  }, [open, initialPremises]);

  // ── Auto-save debounced (2s) ──
  const savePremises = useCallback(
    async (data: DeepPremises) => {
      if (!scenarioId) return;
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from("development_parcelamento_scenarios" as never)
          .update({ deep_premises: data as never })
          .eq("id", scenarioId);

        if (error) throw error;
        setIsDirty(false);
        setLastSaved(new Date());
      } catch (err) {
        console.error("[EditarPremissas] auto-save error:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [scenarioId]
  );

  const triggerAutoSave = useCallback(
    (data: DeepPremises) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => savePremises(data), 2000);
    },
    [savePremises]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Update handlers ──
  function updateProject(updates: Partial<ProjectPremises>) {
    const newPremises = { ...premises, project: { ...premises.project, ...updates } };
    setPremises(newPremises);
    setIsDirty(true);
    triggerAutoSave(newPremises);
  }

  function updateSales(updates: Partial<SalesPremises>) {
    const newPremises = { ...premises, sales: { ...premises.sales, ...updates } };
    setPremises(newPremises);
    setIsDirty(true);
    triggerAutoSave(newPremises);
  }

  function updateLand(updates: Partial<LandPremises>) {
    const newPremises = { ...premises, land: { ...premises.land, ...updates } };
    setPremises(newPremises);
    setIsDirty(true);
    triggerAutoSave(newPremises);
  }

  function updateCosts(updates: Partial<CostsPremises>) {
    const newPremises = { ...premises, costs: { ...premises.costs, ...updates } };
    setPremises(newPremises);
    setIsDirty(true);
    triggerAutoSave(newPremises);
  }

  // ── Save now (manual) ──
  async function handleSaveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await savePremises(premises);
    toast({ title: "Premissas salvas!", description: "Todas as alterações foram salvas." });
  }

  // ── Simular ──
  function handleSimulate() {
    if (!tenantId) return;

    // Cancela debounce pendente antes de simular
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const formValues = toScenarioFormValues(premises);

    simular(
      { developmentId, tenantId, formValues },
      {
        onSuccess: async (result) => {
          // Usa o scenario_id retornado pela mutation (não o antigo do state)
          // para garantir que deep_premises vai pro cenário correto
          const targetScenarioId = result.scenario_id;
          if (targetScenarioId) {
            try {
              await supabase
                .from("development_parcelamento_scenarios" as never)
                .update({ deep_premises: premises as never })
                .eq("id", targetScenarioId);
            } catch (err) {
              console.error("[EditarPremissas] save deep_premises after simulate:", err);
            }
          }
          queryClient.invalidateQueries({ queryKey: parcelamentoQueryKeys.all });
          toast({
            title: "Simulação concluída!",
            description: "VPL, TIR e fluxo de caixa calculados com premissas profundas.",
          });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({
            title: "Erro na simulação",
            description: err instanceof Error ? err.message : "Tente novamente.",
            variant: "destructive",
          });
        },
      }
    );
  }

  // ── Handle close with unsaved changes ──
  function handleClose(nextOpen: boolean) {
    if (!nextOpen && isDirty && !scenarioId) {
      // Sem scenarioId = auto-save não funciona, avisa o usuário
      const ok = window.confirm(
        "Você tem alterações não salvas. Para salvar, clique em 'Simular' primeiro.\n\nDeseja fechar mesmo assim?"
      );
      if (!ok) return;
    }
    onOpenChange(nextOpen);
  }

  // ── Derived ──
  const vgvBruto = calcVGVBruto(premises.project);
  const savedAgo = lastSaved
    ? `${Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s atrás`
    : null;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        className="w-[520px] sm:w-[600px] overflow-y-auto"
        side="right"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-blue-500" />
            Premissas Profundas
          </SheetTitle>
          <SheetDescription>
            {projectName ? `Projeto: ${projectName}` : "Configure as premissas detalhadas."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 pb-28">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="projeto" className="text-xs gap-1">
                <MapPin className="h-3 w-3" />
                Projeto
              </TabsTrigger>
              <TabsTrigger value="vendas" className="text-xs gap-1">
                <ShoppingCart className="h-3 w-3" />
                Vendas
              </TabsTrigger>
              <TabsTrigger value="terreno" className="text-xs gap-1">
                <MapPin className="h-3 w-3" />
                Terreno
              </TabsTrigger>
              <TabsTrigger value="custos" className="text-xs gap-1">
                <Hammer className="h-3 w-3" />
                Custos
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="projeto">
                <TabProjeto data={premises.project} onChange={updateProject} />
              </TabsContent>
              <TabsContent value="vendas">
                <TabVendas data={premises.sales} onChange={updateSales} />
              </TabsContent>
              <TabsContent value="terreno">
                <TabTerreno
                  data={premises.land}
                  onChange={updateLand}
                  vgvBruto={vgvBruto}
                />
              </TabsContent>
              <TabsContent value="custos">
                <TabCustos data={premises.costs} onChange={updateCosts} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* ── Footer fixo ── */}
        <SheetFooter className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3">
          {/* Status bar */}
          <div className="w-full flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              {isSaving ? (
                <span className="text-gray-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Salvando…
                </span>
              ) : isDirty ? (
                <span className="text-amber-500">Alterações não salvas</span>
              ) : savedAgo ? (
                <span className="text-green-500 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Salvo {savedAgo}
                </span>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveNow}
              disabled={!isDirty || isSaving}
              className="h-7 text-xs gap-1"
            >
              <Save className="h-3 w-3" />
              Salvar agora
            </Button>
          </div>

          {/* Buttons */}
          <div className="w-full flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSimulating}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button
              onClick={handleSimulate}
              disabled={isSimulating || !tenantId}
              className="flex-1 gap-2"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Simular
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
