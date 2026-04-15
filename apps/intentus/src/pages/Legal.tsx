import { useState } from "react";
import { useDealRequests, useUpdateDealStatus } from "@/hooks/useDealRequests";
import { DealDetailDialog } from "@/components/deals/DealDetailDialog";
import { KanbanBoard, type KanbanColumn } from "@/components/deals/KanbanBoard";
import { Scale } from "lucide-react";

const columns: KanbanColumn[] = [
  { id: "nao_iniciadas", title: "Não Iniciadas", statuses: ["enviado_juridico"] },
  { id: "analise", title: "Análise Documental", statuses: ["analise_documental", "aguardando_documentos"] },
  { id: "parecer", title: "Parecer / Minuta", statuses: ["parecer_em_elaboracao", "minuta_em_elaboracao"] },
  { id: "validacao", title: "Validação / Ajustes", statuses: ["em_validacao", "ajustes_pendentes", "aprovado_comercial"] },
  { id: "assinatura", title: "Assinatura", statuses: ["contrato_finalizado", "em_assinatura"] },
  { id: "concluidas", title: "Concluídas", statuses: ["concluido", "parecer_negativo", "cancelado"] },
];

export default function Legal() {
  const { data: deals, isLoading } = useDealRequests();
  const updateStatus = useUpdateDealStatus();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const selectedDeal = selectedDealId ? deals?.find((d: any) => d.id === selectedDealId) || null : null;

  const legalDeals = deals?.filter((d: any) => d.status !== "rascunho") || [];

  const handleStatusChange = (dealId: string, fromStatus: string, toStatus: string) => {
    updateStatus.mutate({ dealId, fromStatus, toStatus });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Jurídico</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as solicitações de análise documental, pareceres e elaboração de contratos
        </p>
      </div>

      <KanbanBoard
        columns={columns}
        deals={legalDeals}
        isLoading={isLoading}
        onCardClick={setSelectedDealId}
        emptyIcon={<Scale className="h-8 w-8" />}
        emptyMessage="Nenhuma solicitação"
        onStatusChange={handleStatusChange}
      />

      <DealDetailDialog
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDealId(null)}
        deal={selectedDeal}
        showStatusActions={true}
      />
    </div>
  );
}
