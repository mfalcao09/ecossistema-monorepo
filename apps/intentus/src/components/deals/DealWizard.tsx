import React, { useState } from "react";
import { Building2, Users, FileText, Check, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepSelectProperty } from "./StepSelectProperty";
import { StepLinkParties } from "./StepLinkParties";
import { StepCommercialConditions } from "./StepCommercialConditions";
import { useCreateDealRequest, type DealRequestFormData, type DealRequestParty } from "@/hooks/useDealRequests";
import { toast } from "sonner";

const stepsMeta = [
  { icon: Building2, title: "Selecionar Imóvel" },
  { icon: Users, title: "Vincular Partes" },
  { icon: FileText, title: "Condições Comerciais" },
];

export function DealWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [propertyId, setPropertyId] = useState<string>("");
  const [parties, setParties] = useState<DealRequestParty[]>([]);
  const [commercialData, setCommercialData] = useState<Partial<DealRequestFormData>>({});
  const createDeal = useCreateDealRequest();
  const [submitted, setSubmitted] = useState(false);

  const canGoNext = () => {
    if (currentStep === 0) return !!propertyId;
    if (currentStep === 1) return parties.length > 0;
    if (currentStep === 2) return !!commercialData.deal_type;
    return false;
  };

  const handleSubmit = () => {
    if (!propertyId || !commercialData.deal_type) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    createDeal.mutate(
      {
        property_id: propertyId,
        parties,
        deal_type: commercialData.deal_type!,
        proposed_value: commercialData.proposed_value,
        proposed_monthly_value: commercialData.proposed_monthly_value,
        proposed_start_date: commercialData.proposed_start_date,
        proposed_duration_months: commercialData.proposed_duration_months,
        payment_terms: commercialData.payment_terms,
        guarantee_type: commercialData.guarantee_type,
        commission_percentage: commercialData.commission_percentage,
        commercial_notes: commercialData.commercial_notes,
        captador_person_id: (commercialData as any).captador_person_id,
        vendedor_person_id: (commercialData as any).vendedor_person_id,
      },
      {
        onSuccess: () => setSubmitted(true),
      }
    );
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Solicitação Enviada!</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          A solicitação foi encaminhada para a área jurídica para análise documental e elaboração de parecer.
          Você pode acompanhar o andamento na listagem de solicitações.
        </p>
        <Button variant="outline" onClick={() => {
          setSubmitted(false);
          setCurrentStep(0);
          setPropertyId("");
          setParties([]);
          setCommercialData({});
        }}>
          Iniciar Nova Solicitação
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <nav className="flex items-center justify-center gap-2">
        {stepsMeta.map((step, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => i < currentStep && setCurrentStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                i === currentStep
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : i < currentStep
                    ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <step.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.title}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
            {i < stepsMeta.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <StepSelectProperty
            selectedId={propertyId}
            onSelect={setPropertyId}
          />
        )}
        {currentStep === 1 && (
          <StepLinkParties
            parties={parties}
            onChange={setParties}
          />
        )}
        {currentStep === 2 && (
          <StepCommercialConditions
            data={commercialData}
            onChange={setCommercialData}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>

        {currentStep < 2 ? (
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canGoNext()}
          >
            Próximo
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canGoNext() || createDeal.isPending}
          >
            <Send className="mr-1 h-4 w-4" />
            {createDeal.isPending ? "Enviando..." : "Enviar ao Jurídico"}
          </Button>
        )}
      </div>
    </div>
  );
}
