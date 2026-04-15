import { Card, CardContent } from "@/components/ui/card";
import { Columns3 } from "lucide-react";

export default function SalesPipeline() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Pipeline de Vendas</h1>
        <p className="text-muted-foreground text-sm">Funil visual de vendas: Lead → Visita → Proposta → Aprovação → Contrato</p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Columns3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Em construção</p>
          <p className="text-xs mt-1">O pipeline Kanban de vendas será implementado em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}
