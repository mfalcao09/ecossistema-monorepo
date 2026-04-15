import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useUpdateLead, useDeleteLead,
  leadStatusLabels, leadStatusColors, leadSourceLabels,
  type Lead,
} from "@/hooks/useLeads";
import { useInteractions, useCreateInteraction, interactionTypeLabels } from "@/hooks/useInteractions";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { useConvertLeadToDeal } from "@/hooks/useConvertLeadToDeal";
import { usePropertiesForSelect } from "@/hooks/useContracts";
import { useScoreLead, getScoreLevel, SCORE_LEVEL_LABELS, SCORE_LEVEL_COLORS, SCORE_LEVEL_DOT_COLORS } from "@/hooks/useLeadScoring";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Phone, Mail, MapPin, DollarSign, Calendar, MessageSquare,
  User, ClipboardList, Send, Trash2, ArrowRightCircle, Flame, Zap, Bot,
} from "lucide-react";
import { LeadChatbotPanel } from "./LeadChatbotDialog";

interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function LeadDetailDialog({ open, onOpenChange, lead }: LeadDetailDialogProps) {
  const update = useUpdateLead();
  const remove = useDeleteLead();
  const { data: profiles } = useProfiles();
  const { data: interactions } = useInteractions(lead?.person_id);
  const createInteraction = useCreateInteraction();
  const convertToDeal = useConvertLeadToDeal();
  const { data: properties } = usePropertiesForSelect();
  const scoreLead = useScoreLead();

  const [interactionType, setInteractionType] = useState("ligacao");
  const [interactionNotes, setInteractionNotes] = useState("");
  const [status, setStatus] = useState("");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertPropertyId, setConvertPropertyId] = useState("");
  const [convertDealType, setConvertDealType] = useState<"venda" | "locacao">("locacao");

  if (!lead) return null;

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    update.mutate({ id: lead.id, status: newStatus } as any);
  };

  const handleAssign = (userId: string) => {
    update.mutate({ id: lead.id, assigned_to: userId === "none" ? null : userId } as any);
  };

  const handleAddInteraction = () => {
    if (!lead.person_id || !interactionNotes.trim()) return;
    createInteraction.mutate(
      { person_id: lead.person_id, interaction_type: interactionType, notes: interactionNotes },
      { onSuccess: () => { setInteractionNotes(""); } }
    );
  };

  const assignedProfile = profiles?.find((p: any) => p.user_id === lead.assigned_to);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-bold">{lead.name}</DialogTitle>
            <Badge className={leadStatusColors[lead.status] || ""}>
              {leadStatusLabels[lead.status] || lead.status}
            </Badge>
            {lead.lead_score != null && (
              <Badge className={SCORE_LEVEL_COLORS[getScoreLevel(lead.lead_score)]}>
                <Flame className="h-3 w-3 mr-1" />
                {lead.lead_score} — {SCORE_LEVEL_LABELS[getScoreLevel(lead.lead_score)]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Select value={lead.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Alterar status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(leadStatusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lead.assigned_to || "none"} onValueChange={handleAssign}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Atribuir corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {profiles?.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => scoreLead.mutate(lead.id)}
              disabled={scoreLead.isPending}
            >
              <Zap className="h-3.5 w-3.5" />
              {scoreLead.isPending ? "Pontuando..." : "Pontuar"}
            </Button>
            {lead.status !== "convertido" && lead.status !== "perdido" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => setShowConvertDialog(true)}
              >
                <ArrowRightCircle className="h-3.5 w-3.5" /> Converter em Negócio
              </Button>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <Tabs defaultValue="info" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="interactions">Interações</TabsTrigger>
            <TabsTrigger value="chatbot" className="gap-1">
              <Bot className="h-3 w-3" /> IA Chatbot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                  {lead.preferred_region && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.preferred_region}</span>
                    </div>
                  )}
                  {(lead.budget_min || lead.budget_max) && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lead.budget_min ? `R$ ${Number(lead.budget_min).toLocaleString("pt-BR")}` : "—"} 
                        {" - "}
                        {lead.budget_max ? `R$ ${Number(lead.budget_max).toLocaleString("pt-BR")}` : "—"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Origem:</span>{" "}
                    <Badge variant="outline">{leadSourceLabels[lead.source] || lead.source}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Interesse:</span>{" "}
                    {lead.interest_type || "Não informado"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Responsável:</span>{" "}
                    {assignedProfile?.name || "Não atribuído"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Criado em:</span>{" "}
                    {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>

                {lead.notes && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Observações</Label>
                    <p className="text-sm mt-1 bg-muted/50 rounded-lg p-3">{lead.notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="interactions" className="flex-1 min-h-0 m-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4 space-y-4">
                {lead.person_id ? (
                  <>
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex gap-2">
                        <Select value={interactionType} onValueChange={setInteractionType}>
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(interactionTypeLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        value={interactionNotes}
                        onChange={(e) => setInteractionNotes(e.target.value)}
                        placeholder="Descreva a interação..."
                        rows={2}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={handleAddInteraction}
                        disabled={!interactionNotes.trim() || createInteraction.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Registrar
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {interactions?.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          Nenhuma interação registrada
                        </p>
                      )}
                      {interactions?.map((i: any) => (
                        <div key={i.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 w-px bg-border mt-1" />
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {interactionTypeLabels[i.interaction_type] || i.interaction_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(i.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {i.notes && <p className="mt-1 text-muted-foreground">{i.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Vincule este lead a uma pessoa cadastrada para registrar interações</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="chatbot" className="flex-1 min-h-0 m-0">
            <LeadChatbotPanel leadId={lead.id} leadName={lead.name} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Converter Lead em Negócio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Isso criará um novo negócio a partir do lead <strong>{lead.name}</strong> e marcará o lead como convertido.
          </p>
          <div className="space-y-1.5">
            <Label>Imóvel de Interesse *</Label>
            <Select value={convertPropertyId} onValueChange={setConvertPropertyId}>
              <SelectTrigger><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
              <SelectContent>
                {properties?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Negócio *</Label>
            <Select value={convertDealType} onValueChange={(v) => setConvertDealType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              convertToDeal.mutate(
                { lead, propertyId: convertPropertyId, dealType: convertDealType },
                {
                  onSuccess: () => {
                    setShowConvertDialog(false);
                    onOpenChange(false);
                  },
                }
              );
            }}
            disabled={!convertPropertyId || convertToDeal.isPending}
          >
            <ArrowRightCircle className="h-4 w-4 mr-1" /> Converter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
