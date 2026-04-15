import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ArrowRight, ArrowLeft, FileCheck, Camera, Upload, Home, DollarSign, Users, Calendar } from "lucide-react";
import { useProperties, useUpdateIntakeStatus, type Property } from "@/hooks/useProperties";
import { useContracts, type ContractWithRelations } from "@/hooks/useContracts";
import { useDealRequests } from "@/hooks/useDealRequests";
import type { DealRequest } from "@/lib/dealRequestSchema";
import { intakeStatusLabels, intakeStatusColors, intakePrevStage, intakeNextStage } from "@/lib/intakeStatus";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const stageIcons: Record<string, any> = {
  captado: Camera,
  documentacao_pendente: Upload,
  em_analise: FileCheck,
  aprovado: FileCheck,
  publicado: Building2,
  locado: Home,
};

const INTAKE_STAGES = ["captado", "documentacao_pendente", "em_analise", "aprovado", "publicado", "locado"];

const dealTypeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
};

const contractPartyRoleLabels: Record<string, string> = {
  locatario: "Locatário",
  proprietario: "Proprietário",
  fiador: "Fiador",
  comprador: "Comprador",
  administrador: "Administrador",
  testemunha: "Testemunha",
};

export function IntakeKanban() {
  const { data: properties = [], isLoading } = useProperties({});
  const { data: activeContracts = [] } = useContracts({ status: "ativo", contract_type: "locacao" });
  const { data: dealRequests = [] } = useDealRequests();
  const updateIntake = useUpdateIntakeStatus();
  const navigate = useNavigate();

  const locadoPropertyIds = new Set(activeContracts.map((c) => c.property_id));

  const dealByProperty = new Map<string, DealRequest>();
  dealRequests.forEach((d) => {
    if (d.deal_type === "locacao" && d.status === "concluido") {
      dealByProperty.set(d.property_id, d);
    }
  });

  const columns = INTAKE_STAGES.map((stage) => {
    if (stage === "locado") {
      return {
        key: stage,
        label: intakeStatusLabels[stage] || stage,
        items: [] as Property[],
        locadoContracts: activeContracts,
      };
    }
    return {
      key: stage,
      label: intakeStatusLabels[stage] || stage,
      items: properties.filter(
        (p) => (p as any).intake_status === stage && !locadoPropertyIds.has(p.id)
      ),
      locadoContracts: [] as ContractWithRelations[],
    };
  });

  function handleAdvance(property: Property, nextStatus: string) {
    updateIntake.mutate({ id: property.id, intake_status: nextStatus });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const sourceKey = result.source.droppableId;
    const destKey = result.destination.droppableId;
    if (sourceKey === destKey || destKey === "locado") return;

    const propertyId = result.draggableId;
    updateIntake.mutate({ id: propertyId, intake_status: destKey });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((col) => {
            const Icon = stageIcons[col.key] || Building2;
            const isLocado = col.key === "locado";
            const itemCount = isLocado ? col.locadoContracts.length : col.items.length;

            return (
              <div key={col.key} className="min-w-[280px] flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className={intakeStatusColors[col.key]}>
                    {col.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{itemCount}</span>
                </div>
                <Droppable droppableId={col.key} isDropDisabled={isLocado}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-[100px] rounded-lg p-1 transition-colors ${snapshot.isDraggingOver && !isLocado ? "bg-primary/10" : ""}`}
                    >
                      {itemCount === 0 && !snapshot.isDraggingOver ? (
                        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                          Nenhum imóvel
                        </p>
                      ) : isLocado ? (
                        col.locadoContracts.map((contract) => {
                          const deal = dealByProperty.get(contract.property_id);
                          return deal ? (
                            <DealCard key={contract.id} deal={deal} contract={contract} navigate={navigate} />
                          ) : (
                            <ContractSummaryCard key={contract.id} contract={contract} navigate={navigate} />
                          );
                        })
                      ) : (
                          col.items.map((p, index) => {
                          const prev = intakePrevStage[col.key];
                          const next = intakeNextStage[col.key];
                          return (
                            <Draggable key={p.id} draggableId={p.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={dragSnapshot.isDragging ? "opacity-90" : ""}
                                >
                                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/imoveis/${p.id}`)}>
                                    <CardContent className="p-3 space-y-2">
                                      <div className="flex items-start gap-2">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium truncate">{p.title}</p>
                                          <p className="text-xs text-muted-foreground truncate">{p.neighborhood ? `${p.neighborhood}, ` : ""}{p.city || ""}</p>
                                        </div>
                                      </div>
                                      {(p as any).property_code && (
                                        <p className="text-xs text-muted-foreground font-mono">Cód. {(p as any).property_code}</p>
                                      )}
                                      {(prev || next) && (
                                        <div className="flex gap-1">
                                          {prev && (
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-6 w-6"
                                              title={`Voltar para ${intakeStatusLabels[prev]}`}
                                              onClick={(e) => { e.stopPropagation(); handleAdvance(p, prev); }}
                                            >
                                              <ArrowLeft className="h-3 w-3" />
                                            </Button>
                                          )}
                                          {next && (
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="h-6 w-6"
                                              title={`Avançar para ${intakeStatusLabels[next]}`}
                                              onClick={(e) => { e.stopPropagation(); handleAdvance(p, next); }}
                                            >
                                              <ArrowRight className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}

function DealCard({ deal, contract, navigate }: { deal: DealRequest; contract: ContractWithRelations; navigate: (path: string) => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" onClick={() => navigate(`/imoveis/${contract.property_id}`)}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-violet-100 dark:bg-violet-900/30">
            <Home className="h-3.5 w-3.5 text-violet-700 dark:text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{deal.properties?.title || contract.properties?.title || "Imóvel"}</p>
            <Badge variant="outline" className="mt-0.5 text-[10px] h-4 bg-primary/10 text-primary border-primary/20">
              Via Negócio
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span>{dealTypeLabels[deal.deal_type] || deal.deal_type}</span>
        </div>
        {(deal.proposed_monthly_value || contract.monthly_value) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>R$ {Number(deal.proposed_monthly_value || contract.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</span>
          </div>
        )}
        {deal.deal_request_parties && deal.deal_request_parties.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {deal.deal_request_parties.map((p: any) => p.people?.name).filter(Boolean).join(", ")}
            </span>
          </div>
        )}
        {contract.start_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}{contract.end_date ? ` → ${format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}` : ""}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractSummaryCard({ contract, navigate }: { contract: ContractWithRelations; navigate: (path: string) => void }) {
  const parties = contract.contract_parties || [];
  const locatario = parties.find((p) => p.role === "locatario");
  const proprietario = parties.find((p) => p.role === "proprietario");

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-muted-foreground/40" onClick={() => navigate(`/imoveis/${contract.property_id}`)}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{contract.properties?.title || "Imóvel"}</p>
            <Badge variant="outline" className="mt-0.5 text-[10px] h-4 bg-muted text-muted-foreground">
              Contrato Direto
            </Badge>
          </div>
        </div>
        {contract.monthly_value && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>R$ {Number(contract.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</span>
          </div>
        )}
        {(locatario || proprietario) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {[locatario?.people?.name, proprietario?.people?.name].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
        {contract.start_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}{contract.end_date ? ` → ${format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}` : ""}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
