import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useSaasPipeline,
  stageLabels,
  stageColors,
  stageDescriptions,
  sourceLabels,
  type SaasPipelineStage,
  type SaasPipelineLead,
} from "@/hooks/useSaasPipeline";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  Crown,
  GripVertical,
  Mail,
  Phone,
  Plus,
  Megaphone,
  User,
  Trash2,
  ArrowRight,
} from "lucide-react";

const PIPELINE_COLUMNS: { id: SaasPipelineStage; title: string }[] = [
  { id: "lead", title: "Lead" },
  { id: "contato_realizado", title: "Iniciou Cadastro" },
  { id: "demonstracao", title: "Iniciou Pagamento" },
  { id: "proposta_enviada", title: "Finalizou Pagamento" },
  { id: "checkout_iniciado", title: "Convertido" },
  { id: "convertido", title: "Plataforma Ativada ✅" },
  { id: "perdido", title: "Perdido ❌" },
];

const ACTIVE_COLUMNS = PIPELINE_COLUMNS.filter((c) => c.id !== "convertido" && c.id !== "perdido");
const CLOSED_COLUMNS = PIPELINE_COLUMNS.filter((c) => c.id === "convertido" || c.id === "perdido");

export default function SuperAdminComercial() {
  const { leads, isLoading, createLead, updateLead, deleteLead } = useSaasPipeline();
  const [formOpen, setFormOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<SaasPipelineLead | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    source: "site",
    plan_interest: "",
    notes: "",
  });

  const getByStage = (stage: SaasPipelineStage) =>
    leads?.filter((l) => l.stage === stage) || [];

  const handleCreate = () => {
    createLead.mutate(
      {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        source: form.source || null,
        plan_interest: form.plan_interest || null,
        notes: form.notes || null,
        stage: "lead",
      },
      {
        onSuccess: () => {
          setFormOpen(false);
          setForm({ name: "", email: "", phone: "", company_name: "", source: "site", plan_interest: "", notes: "" });
        },
      }
    );
  };

  const handleAdvance = (lead: SaasPipelineLead) => {
    const stages: SaasPipelineStage[] = ["lead", "contato_realizado", "demonstracao", "proposta_enviada", "checkout_iniciado", "convertido"];
    const idx = stages.indexOf(lead.stage);
    if (idx < stages.length - 1) {
      const nextStage = stages[idx + 1];
      updateLead.mutate({
        id: lead.id,
        stage: nextStage,
        ...(nextStage === "convertido" ? { converted_at: new Date().toISOString() } : {}),
      });
    }
  };

  const handleLose = (lead: SaasPipelineLead) => {
    updateLead.mutate({ id: lead.id, stage: "perdido" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Comercial SaaS
          </h1>
          <p className="text-muted-foreground text-sm">
            Pipeline de vendas da plataforma: Jornada do cliente desde o interesse até a conversão
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Lead
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {PIPELINE_COLUMNS.map((col) => {
          const count = getByStage(col.id).length;
          return (
            <Card key={col.id} className="text-center">
              <CardContent className="py-3 px-2">
                <p className="text-2xl font-bold">{isLoading ? "-" : count}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{col.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ACTIVE_COLUMNS.map((c) => (
            <div key={c.id} className="w-[300px] shrink-0 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-4 min-w-max pb-4">
            {ACTIVE_COLUMNS.map((col) => {
              const items = getByStage(col.id);
              return (
                <div key={col.id} className="w-[300px] shrink-0 flex flex-col">
                  <div className="flex flex-col gap-0.5 px-2 py-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                      <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                        {items.length}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{stageDescriptions[col.id]}</p>
                  </div>
                  <ScrollArea
                    className="flex-1 rounded-lg bg-muted/40 p-2"
                    style={{ maxHeight: "calc(100vh - 340px)" }}
                  >
                    <div className="space-y-3 pr-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-6">Nenhum lead</p>
                      ) : (
                        items.map((lead) => (
                          <PipelineCard
                            key={lead.id}
                            lead={lead}
                            onClick={() => setDetailLead(lead)}
                            onAdvance={() => handleAdvance(lead)}
                            onLose={() => handleLose(lead)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}

            {/* Closed columns (smaller) */}
            {CLOSED_COLUMNS.map((col) => {
              const items = getByStage(col.id);
              return (
                <div key={col.id} className="w-[260px] shrink-0 flex flex-col">
                  <div className="flex flex-col gap-0.5 px-2 py-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                      <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                        {items.length}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{stageDescriptions[col.id]}</p>
                  </div>
                  <ScrollArea
                    className="flex-1 rounded-lg bg-muted/40 p-2"
                    style={{ maxHeight: "calc(100vh - 340px)" }}
                  >
                    <div className="space-y-3 pr-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-6">Nenhum lead</p>
                      ) : (
                        items.map((lead) => (
                          <PipelineCard
                            key={lead.id}
                            lead={lead}
                            onClick={() => setDetailLead(lead)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead SaaS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Empresa</Label>
              <Input value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(sourceLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano de interesse</Label>
                <Input value={form.plan_interest} onChange={(e) => setForm((p) => ({ ...p, plan_interest: e.target.value }))} placeholder="Ex: Professional" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name || createLead.isPending}>
              {createLead.isPending ? "Salvando..." : "Criar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <LeadDetailDialog
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onUpdate={(id, data) => updateLead.mutate({ id, ...data })}
        onDelete={(id) => {
          deleteLead.mutate(id);
          setDetailLead(null);
        }}
        onAdvance={(lead) => {
          handleAdvance(lead);
          setDetailLead(null);
        }}
        onLose={(lead) => {
          handleLose(lead);
          setDetailLead(null);
        }}
      />
    </div>
  );
}

function PipelineCard({
  lead,
  onClick,
  onAdvance,
  onLose,
}: {
  lead: SaasPipelineLead;
  onClick: () => void;
  onAdvance?: () => void;
  onLose?: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="text-sm font-semibold leading-tight">{lead.name}</CardTitle>
        {lead.company_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>{lead.company_name}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1.5 text-xs">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.source && (
          <Badge variant="outline" className="text-[10px]">
            {sourceLabels[lead.source] || lead.source}
          </Badge>
        )}
        {lead.plan_interest && (
          <Badge variant="secondary" className="text-[10px]">
            <Crown className="h-2.5 w-2.5 mr-0.5" />
            {lead.plan_interest}
          </Badge>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
        </div>
        {(onAdvance || onLose) && (
          <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
            {onAdvance && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary" onClick={onAdvance}>
                Avançar <ArrowRight className="h-3 w-3 ml-0.5" />
              </Button>
            )}
            {onLose && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={onLose}>
                Perder
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadDetailDialog({
  lead,
  onClose,
  onUpdate,
  onDelete,
  onAdvance,
  onLose,
}: {
  lead: SaasPipelineLead | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<SaasPipelineLead>) => void;
  onDelete: (id: string) => void;
  onAdvance: (lead: SaasPipelineLead) => void;
  onLose: (lead: SaasPipelineLead) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");

  if (!lead) return null;

  return (
    <Dialog open={!!lead} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {lead.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className={stageColors[lead.stage]}>{stageLabels[lead.stage]}</Badge>
            {lead.source && <Badge variant="outline">{sourceLabels[lead.source] || lead.source}</Badge>}
            {lead.plan_interest && (
              <Badge variant="secondary">
                <Crown className="h-3 w-3 mr-1" />
                {lead.plan_interest}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {lead.email && (
              <div>
                <span className="text-muted-foreground text-xs">Email</span>
                <p>{lead.email}</p>
              </div>
            )}
            {lead.phone && (
              <div>
                <span className="text-muted-foreground text-xs">Telefone</span>
                <p>{lead.phone}</p>
              </div>
            )}
            {lead.company_name && (
              <div>
                <span className="text-muted-foreground text-xs">Empresa</span>
                <p>{lead.company_name}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs">Criado em</span>
              <p>{format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
          </div>

          {lead.notes && (
            <div>
              <span className="text-muted-foreground text-xs">Observações</span>
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}

          {lead.lost_reason && (
            <div>
              <span className="text-muted-foreground text-xs">Motivo da perda</span>
              <p className="text-sm">{lead.lost_reason}</p>
            </div>
          )}

          {lead.converted_at && (
            <div>
              <span className="text-muted-foreground text-xs">Convertido em</span>
              <p className="text-sm">{format(new Date(lead.converted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
          )}

          {/* Quick notes update */}
          <div>
            <Label className="text-xs">Adicionar/atualizar observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Atualizar observações..."
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              disabled={!notes}
              onClick={() => {
                onUpdate(lead.id, { notes: (lead.notes ? lead.notes + "\n" : "") + notes });
                setNotes("");
              }}
            >
              Salvar observação
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="destructive" size="sm" onClick={() => onDelete(lead.id)} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <div className="flex-1" />
          {lead.stage !== "perdido" && lead.stage !== "convertido" && (
            <>
              <Button variant="outline" size="sm" onClick={() => onLose(lead)}>
                Marcar como Perdido
              </Button>
              <Button size="sm" onClick={() => onAdvance(lead)} className="gap-1">
                Avançar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
