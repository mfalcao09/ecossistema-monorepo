import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { saleStageLabels, saleStageColors } from "@/lib/intakeStatus";

const SALE_STAGES = ["proposta", "aceite", "promessa_cv", "escritura", "registro"];

interface SaleStagePipelineProps {
  currentStage: string | null;
  onAdvance: (newStage: string) => void;
  isPending?: boolean;
}

export function SaleStagePipeline({ currentStage, onAdvance, isPending }: SaleStagePipelineProps) {
  const currentIndex = SALE_STAGES.indexOf(currentStage || "");

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de Venda</p>
      <div className="flex items-center gap-1 flex-wrap">
        {SALE_STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isNext = idx === currentIndex + 1;

          return (
            <div key={stage} className="flex items-center gap-1">
              {idx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
              <Badge
                variant={isCurrent ? "default" : isCompleted ? "secondary" : "outline"}
                className={`${isCurrent ? saleStageColors[stage] : ""} ${isCompleted ? "opacity-60" : ""} cursor-default`}
              >
                {isCompleted && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {saleStageLabels[stage]}
              </Badge>
              {isNext && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs text-primary"
                  onClick={() => onAdvance(stage)}
                  disabled={isPending}
                >
                  Avançar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
