import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FilePlus,
  Brain,
  Layout,
  Upload,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  LayoutDashboard,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Rocket,
} from "lucide-react";

// ============================================================
// CLMOnboardingTour — Tour guiado step-by-step do CLM
// Fase 4, Épico 3: Onboarding Guiado
// ============================================================

interface TourStep {
  id: string;
  title: string;
  description: string;
  tip: string;
  icon: React.ReactNode;
  illustration: string; // emoji como ilustração simples
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao CLM Intentus! 🎉",
    description:
      "Você está prestes a conhecer o sistema de gestão de contratos mais inteligente do mercado. Vamos fazer um tour rápido pelos principais recursos.",
    tip: "Este tour leva apenas 2 minutos e vai te ajudar a aproveitar ao máximo a plataforma.",
    icon: <Rocket className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "🚀",
  },
  {
    id: "create_contract",
    title: "Crie contratos com IA",
    description:
      "Clique em '+ Novo Contrato' para criar um contrato do zero ou use a IA para gerar automaticamente a partir de uma descrição simples.",
    tip: "A IA pode gerar contratos completos com cláusulas, partes e valores em segundos!",
    icon: <FilePlus className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "📝",
  },
  {
    id: "ai_insights",
    title: "Análise Inteligente com IA",
    description:
      "Cada contrato pode ser analisado pela IA para identificar riscos, cláusulas críticas e oportunidades de melhoria.",
    tip: "Abra qualquer contrato e clique em 'Insights de IA' para ver a análise completa.",
    icon: <Brain className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "🧠",
  },
  {
    id: "templates",
    title: "Templates Reutilizáveis",
    description:
      "Configure modelos padrão para seus contratos mais comuns. Templates economizam tempo e garantem consistência.",
    tip: "Acesse a aba 'Templates' e crie seu primeiro modelo — você nunca mais vai digitar tudo do zero.",
    icon: <Layout className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "📋",
  },
  {
    id: "import",
    title: "Importe Contratos Existentes",
    description:
      "Tem contratos em PDF ou Word? Importe-os e a IA extrai automaticamente as informações: partes, valores, datas e cláusulas.",
    tip: "Use o botão 'Importar' e arraste seu arquivo — a IA faz o resto.",
    icon: <Upload className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "📤",
  },
  {
    id: "approvals",
    title: "Fluxo de Aprovações",
    description:
      "Configure regras para que contratos acima de determinado valor ou de tipos específicos passem por aprovação antes de serem finalizados.",
    tip: "Isso garante governança e controle sem burocracia — tudo dentro da plataforma.",
    icon: <CheckCircle2 className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "✅",
  },
  {
    id: "reports",
    title: "Relatórios e KPIs",
    description:
      "Acompanhe o desempenho do seu portfólio com dashboards visuais: pipeline, vencimentos, valores por status e muito mais.",
    tip: "Acesse 'Relatórios' no menu para ver o panorama completo dos seus contratos.",
    icon: <BarChart3 className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "📊",
  },
  {
    id: "chatbot",
    title: "Chatbot Jurídico com IA",
    description:
      "Tire dúvidas jurídicas sobre seus contratos conversando com nosso assistente de IA especializado em direito contratual.",
    tip: "Pergunte coisas como 'Qual o risco desta cláusula?' ou 'Preciso de multa rescisória neste contrato?'",
    icon: <MessageSquare className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "💬",
  },
  {
    id: "dashboard",
    title: "Command Center",
    description:
      "O Command Center é sua visão consolidada: KPIs em tempo real, alertas de vencimento, pipeline de contratos e ações pendentes — tudo em um só lugar.",
    tip: "É a primeira tela que você deve acessar todo dia para manter o controle total.",
    icon: <LayoutDashboard className="h-8 w-8 text-[#e2a93b]" />,
    illustration: "🎯",
  },
];

interface CLMOnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

export default function CLMOnboardingTour({
  open,
  onClose,
  onAction,
}: CLMOnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, onClose]);

  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reset ao abrir
  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  // Teclado: setas e Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      else if (e.key === "ArrowLeft") handlePrevious();
      else if (e.key === "Escape") handleSkip();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleNext, handlePrevious, handleSkip]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2D2D4E] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#e2a93b]" />
              <span className="text-white font-semibold">Tour do CLM</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {currentStep + 1} de {TOUR_STEPS.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#e2a93b] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Conteúdo do step */}
        <div className="px-6 py-6">
          {/* Ilustração */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e2a93b]/10 to-[#e2a93b]/5 flex items-center justify-center text-4xl border border-[#e2a93b]/20">
              {step.illustration}
            </div>
          </div>

          {/* Ícone + Título */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
          </div>

          {/* Descrição */}
          <p className="text-sm text-gray-600 text-center leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Dica */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-[#e2a93b] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Dica:</span> {step.tip}
              </p>
            </div>
          </div>

          {/* Dots de navegação */}
          <div className="flex justify-center gap-1.5 mt-5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? "w-6 bg-[#e2a93b]"
                    : idx < currentStep
                    ? "w-2 bg-[#e2a93b]/50"
                    : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer com navegação */}
        <DialogFooter className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between sm:justify-between">
          <div>
            {!isFirstStep ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-600"
              >
                Pular tour
              </Button>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleNext}
            className="bg-[#e2a93b] hover:bg-[#c99430] text-white"
          >
            {isLastStep ? (
              <>
                Começar a usar!
                <Rocket className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
