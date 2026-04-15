import { Card, CardContent } from "@/components/ui/card";
import { FileCheck } from "lucide-react";

export default function DevContracts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Contratos de Lançamento</h1>
        <p className="text-muted-foreground text-sm">Gestão de contratos gerados a partir de propostas aprovadas</p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Em construção</p>
          <p className="text-xs mt-1">A gestão de contratos de lançamento será implementada em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}
