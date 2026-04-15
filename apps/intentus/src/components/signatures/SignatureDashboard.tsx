import { Card, CardContent } from "@/components/ui/card";
import { Send, CheckCircle2, XCircle, FileEdit, Upload } from "lucide-react";
import DocumentUploadArea from "./DocumentUploadArea";

interface Props {
  kpis: { em_processo: number; finalizados: number; cancelados: number; rascunhos: number; total: number };
  onQuickUpload: (files: File[]) => void;
}

const KPI_CARDS = [
  { key: "em_processo", label: "Em Processo", icon: Send, color: "text-amber-600" },
  { key: "finalizados", label: "Finalizados", icon: CheckCircle2, color: "text-green-600" },
  { key: "cancelados", label: "Cancelados", icon: XCircle, color: "text-destructive" },
  { key: "rascunhos", label: "Rascunhos", icon: FileEdit, color: "text-muted-foreground" },
] as const;

export default function SignatureDashboard({ kpis, onQuickUpload }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map((card) => (
          <Card key={card.key}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${card.color} shrink-0`} />
              <div>
                <div className="text-2xl font-bold">{kpis[card.key]}</div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DocumentUploadArea onFilesSelected={onQuickUpload} compact />
    </div>
  );
}
