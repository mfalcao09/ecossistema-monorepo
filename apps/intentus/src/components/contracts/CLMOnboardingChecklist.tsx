import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FilePlus,
  Layout,
  Upload,
  Brain,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  Check,
  Circle,
  Sparkles,
  X,
  PartyPopper,
  Play,
  Trash2,
  Loader2,
} from "lucide-react";
import { useOnboardingProgress, OnboardingStep } from "@/hooks/useOnboardingProgress";
import { useDemoMode } from "@/hooks/useDemoMode";

// ============================================================
// CLMOnboardingChecklist — Widget de checklist progressivo
// Fase 4, Épico 3: Onboarding Guiado do CLM
// ============================================================

interface CLMOnboardingChecklistProps {
  onAction?: (action: string) => void;
}

// Mapa de ícones
function StepIcon({ iconName, className }: { iconName: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    FilePlus: <FilePlus className={className} />,
    Layout: <Layout className={className} />,
    Upload: <Upload className={className} />,
    Brain: <Brain className={className} />,
    CheckCircle2: <CheckCircle2 className={className} />,
    BarChart3: <BarChart3 className={className} />,
    MessageSquare: <MessageSquare className={className} />,
    LayoutDashboard: <LayoutDashboard className={className} />,
  };
  return <>{icons[iconName] || <Circle className={className} />}</>;
}

export default function CLMOnboardingChecklist({ onAction }: CLMOnboardingChecklistProps) {
  const {
    steps,
    completedCount,
    totalSteps,
    progressPercent,
    isComplete,
    completeStep,
    markTourSeen,
  } = useOnboardingProgress();

  const [isOpen, setIsOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Se completo ou dispensado, não mostrar
  if (isComplete || dismissed) {
    if (isComplete) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <PartyPopper className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Onboarding concluído!</p>
              <p className="text-sm text-green-600">
                Você completou todos os passos. O CLM está pronto para uso.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-white border border-[#e2a93b]/30 rounded-lg shadow-sm mb-4 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2D2D4E] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#e2a93b]" />
              <span className="text-white font-medium text-sm">
                Primeiros Passos no CLM
              </span>
              <Badge className="bg-[#e2a93b] text-[#1A1A2E] text-[10px] px-1.5 hover:bg-[#c99430]">
                {completedCount}/{totalSteps}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setDismissed(true);
                  markTourSeen();
                }}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <CollapsibleTrigger asChild>
                <button className="text-gray-400 hover:text-white transition-colors p-1">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-2">
            <Progress
              value={progressPercent}
              className="h-1.5 bg-white/20"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {progressPercent}% concluído
            </p>
          </div>
        </div>

        {/* Steps */}
        <CollapsibleContent>
          <div className="divide-y divide-gray-100">
            {steps.map((step, idx) => (
              <StepItem
                key={step.id}
                step={step}
                index={idx}
                onComplete={() => completeStep(step.id)}
                onAction={() => onAction?.(step.action || step.id)}
              />
            ))}
          </div>

          {/* Demo Mode Section */}
          <DemoModeSection />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Item individual do checklist
function StepItem({
  step,
  index,
  onComplete,
  onAction,
}: {
  step: OnboardingStep;
  index: number;
  onComplete: () => void;
  onAction: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 flex items-start gap-3 transition-colors ${
        step.completed ? "bg-green-50/50" : "hover:bg-gray-50"
      }`}
    >
      {/* Checkbox visual */}
      <button
        onClick={onComplete}
        disabled={step.completed}
        className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          step.completed
            ? "bg-green-500 border-green-500"
            : "border-gray-300 hover:border-[#e2a93b]"
        }`}
      >
        {step.completed && <Check className="h-3 w-3 text-white" />}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StepIcon
            iconName={step.icon}
            className={`h-4 w-4 flex-shrink-0 ${
              step.completed ? "text-green-500" : "text-[#e2a93b]"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              step.completed ? "text-green-700 line-through" : "text-gray-900"
            }`}
          >
            {step.title}
          </span>
        </div>
        <p
          className={`text-xs mt-0.5 ml-6 ${
            step.completed ? "text-green-600" : "text-muted-foreground"
          }`}
        >
          {step.description}
        </p>
      </div>

      {/* Botão de ação */}
      {!step.completed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          className="text-[#e2a93b] hover:text-[#c99430] hover:bg-[#e2a93b]/10 h-7 text-xs flex-shrink-0"
        >
          Fazer agora
        </Button>
      )}
    </div>
  );
}

// Seção de modo demonstração
function DemoModeSection() {
  const { hasDemoData, demoCount, isChecking, isSeeding, isCleaning, seedDemo, cleanupDemo } =
    useDemoMode();

  const isLoading = isSeeding || isCleaning;

  return (
    <div className="border-t border-dashed border-gray-200 bg-gray-50/50 px-4 py-3">
      <p className="text-xs text-muted-foreground mb-2">
        {hasDemoData
          ? `${demoCount} itens de exemplo carregados. Remova quando quiser.`
          : "Quer explorar o CLM sem cadastrar dados reais?"}
      </p>

      <div className="flex items-center gap-2">
        {!hasDemoData && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedDemo()}
            disabled={isLoading || isChecking}
            className="h-7 text-xs border-[#e2a93b]/40 text-[#e2a93b] hover:bg-[#e2a93b]/10 hover:text-[#c99430]"
          >
            {isSeeding ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1.5" />
            )}
            Experimentar com dados de exemplo
          </Button>
        )}

        {hasDemoData && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cleanupDemo()}
            disabled={isLoading}
            className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            {isCleaning ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1.5" />
            )}
            Remover dados de exemplo
          </Button>
        )}
      </div>
    </div>
  );
}
