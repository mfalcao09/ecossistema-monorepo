import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, AlertTriangle, CheckCircle, TrendingUp, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { useDefaultRiskAI, type RiskAssessment } from "@/hooks/useDefaultRiskAI";

const riskConfig = {
  baixo: { color: "bg-green-100 text-green-800 dark:bg-green-900/30", bar: "bg-green-500", icon: CheckCircle, iconColor: "text-green-600", label: "Baixo Risco" },
  medio: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30", bar: "bg-amber-500", icon: AlertTriangle, iconColor: "text-amber-600", label: "Risco Médio" },
  alto: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30", bar: "bg-orange-500", icon: TrendingUp, iconColor: "text-orange-600", label: "Alto Risco" },
  critico: { color: "bg-red-100 text-red-800 dark:bg-red-900/30", bar: "bg-red-500", icon: ShieldAlert, iconColor: "text-red-600", label: "Risco Crítico" },
};

const actionLabels: Record<string, { label: string; color: string }> = {
  monitorar: { label: "Monitorar", color: "bg-green-100 text-green-800" },
  contato_preventivo: { label: "Contato Preventivo", color: "bg-blue-100 text-blue-800" },
  acordo_amigavel: { label: "Acordo Amigável", color: "bg-amber-100 text-amber-800" },
  notificacao_formal: { label: "Notificação Formal", color: "bg-orange-100 text-orange-800" },
  encaminhar_juridico: { label: "Encaminhar ao Jurídico", color: "bg-red-100 text-red-800" },
};

interface DefaultRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  personName: string;
  contractId?: string;
}

export function DefaultRiskDialog({ open, onOpenChange, personId, personName, contractId }: DefaultRiskDialogProps) {
  const { analyze, loading, result, reset } = useDefaultRiskAI();

  function handleOpen(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleAnalyze() {
    await analyze({ person_id: personId, contract_id: contractId });
  }

  const cfg = result ? riskConfig[result.risk_level] : null;
  const RiskIcon = cfg?.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Score de Risco — {personName}
          </DialogTitle>
        </DialogHeader>

        {!result && !loading && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ShieldAlert className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Análise Preditiva de Inadimplência</p>
              <p className="text-sm text-muted-foreground mt-1">
                A IA analisará o histórico de pagamentos e comportamento para calcular o score de risco.
              </p>
            </div>
            <Button onClick={handleAnalyze} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Analisar com IA
            </Button>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Analisando histórico de pagamentos e calculando risco...</p>
          </div>
        )}

        {result && cfg && (
          <div className="space-y-4">
            {/* Score gauge */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {RiskIcon && <RiskIcon className={`h-5 w-5 ${cfg.iconColor}`} />}
                    <span className="font-semibold">{cfg.label}</span>
                  </div>
                  <Badge className={cfg.color}>{result.risk_score}/100</Badge>
                </div>
                <div className="space-y-1">
                  <Progress value={result.risk_score} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sem risco</span>
                    <span>Risco máximo</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Probabilidade de inadimplência (90d):</span>
                  <span className="text-sm font-bold">{result.probability_default.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Recommended action */}
            {result.recommended_action && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Ação Recomendada</p>
                  <Badge className={`text-sm ${actionLabels[result.recommended_action]?.color || "bg-muted"}`}>
                    {result.recommended_action_label || actionLabels[result.recommended_action]?.label}
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Payment behavior */}
            {result.payment_behavior && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium mb-1 text-muted-foreground">Comportamento de Pagamento</p>
                  <p className="text-sm">{result.payment_behavior}</p>
                </CardContent>
              </Card>
            )}

            {/* Reasoning */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium mb-1 text-muted-foreground">Análise Detalhada</p>
                <p className="text-sm">{result.reasoning}</p>
              </CardContent>
            </Card>

            {/* Risk & positive factors */}
            <div className="grid grid-cols-2 gap-3">
              {result.positive_factors && result.positive_factors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1 text-green-700">
                    <CheckCircle className="h-3 w-3" /> Pontos Positivos
                  </p>
                  <ul className="space-y-1">
                    {result.positive_factors.map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1"><span className="text-green-500">•</span>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.risk_factors && result.risk_factors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1 text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Fatores de Risco
                  </p>
                  <ul className="space-y-1">
                    {result.risk_factors.map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1"><span className="text-red-500">•</span>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {result && (
            <Button variant="ghost" size="sm" onClick={handleAnalyze} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reanalisar
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
