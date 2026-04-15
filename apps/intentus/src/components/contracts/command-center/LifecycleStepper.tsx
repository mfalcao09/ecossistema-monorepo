/**
 * LifecycleStepper — Visualização do fluxo de transição entre status
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, CircleDot, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_STATUS_COLORS,
  CONTRACT_LIFECYCLE_PHASES,
  type ContractStatus,
} from "@/lib/clmApi";
import { STATUS_ICONS } from "./constants";

export function LifecycleStepper() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Ciclo de Vida do Contrato
        </CardTitle>
        <CardDescription>
          Fluxo de transição entre status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {CONTRACT_LIFECYCLE_PHASES.map((phase, idx) => {
            const Icon = STATUS_ICONS[phase.key] || CircleDot;
            const colorClass = CONTRACT_STATUS_COLORS[phase.key as ContractStatus];

            return (
              <div key={phase.key} className="flex items-center">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2",
                      colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] mt-1 text-center font-medium text-muted-foreground">
                    {phase.label}
                  </span>
                </div>
                {idx < CONTRACT_LIFECYCLE_PHASES.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
