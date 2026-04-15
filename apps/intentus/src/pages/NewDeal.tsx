import { DealWizard } from "@/components/deals/DealWizard";

export default function NewDeal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Iniciar Novo Negócio</h1>
        <p className="text-sm text-muted-foreground">
          Conduza o processo de venda, locação ou administração do início ao contrato
        </p>
      </div>

      <DealWizard />
    </div>
  );
}
