import { useState, useRef } from "react";
import { useContractObligations, useCreateObligation, useCompleteObligation, useDeleteObligation } from "@/hooks/useContractObligations";
import { obligationTypeLabels, obligationStatusLabels, obligationStatusColors, responsiblePartyLabels, recurrenceLabels } from "@/lib/clmSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, CheckSquare, Trash2, AlertTriangle, CalendarDays, Sparkles, Loader2, Upload } from "lucide-react";
import { ObligationPreviewPanel, type AIExtractedObligation } from "@/components/contracts/ObligationPreviewPanel";
import { extractTextFromPdf } from "@/lib/pdfTextExtractor";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  contractId: string;
}

export function ContractObligationsTab({ contractId }: Props) {
  const { data: obligations, isLoading } = useContractObligations(contractId);
  const create = useCreateObligation();
  const complete = useCompleteObligation();
  const remove = useDeleteObligation();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  // AI extraction state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiStep, setAiStep] = useState<"upload" | "processing" | "preview">("upload");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiProgress, setAiProgress] = useState("");
  const [aiObligations, setAiObligations] = useState<AIExtractedObligation[]>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  const resetAiDialog = () => {
    setAiStep("upload");
    setAiFile(null);
    setAiProgress("");
    setAiObligations([]);
    setAiSaving(false);
  };

  const handleAiExtract = async () => {
    if (!aiFile) return;
    setAiStep("processing");
    try {
      setAiProgress("Extraindo texto do PDF...");
      const text = await extractTextFromPdf(aiFile);
      if (!text || text.length < 50) throw new Error("Não foi possível extrair texto do PDF.");

      setAiProgress("Extraindo obrigações com IA...");
      const { data, error } = await supabase.functions.invoke("parse-contract-ai", {
        body: { contract_text: text, addenda_texts: [] },
      });
      if (error) throw new Error(error.message || "Erro de comunicação.");
      if (data?.error) throw new Error(data.error);

      const extracted: AIExtractedObligation[] = (data.obligationsData || []).map((o: any) => ({ ...o, selected: true }));
      if (extracted.length === 0) {
        toast.info("Nenhuma obrigação encontrada no documento.");
        resetAiDialog();
        setAiDialogOpen(false);
        return;
      }
      setAiObligations(extracted);
      setAiStep("preview");
    } catch (err: any) {
      console.error("AI obligation extraction error:", err);
      toast.error(err.message || "Erro ao extrair obrigações.");
      setAiStep("upload");
    }
  };

  const handleAiSave = async () => {
    const selected = aiObligations.filter((o) => o.selected !== false && o.title && o.due_date);
    if (selected.length === 0) { toast.warning("Nenhuma obrigação selecionada com data."); return; }
    setAiSaving(true);
    try {
      const tenant_id = await getAuthTenantId();
      const rows = selected.map((o) => ({
        contract_id: contractId,
        title: o.title,
        description: o.description ? `${o.description}${o.source_clause ? ` (Ref: ${o.source_clause})` : ""}` : (o.source_clause || null),
        obligation_type: o.obligation_type || "operacional",
        responsible_party: o.responsible_party || "administradora",
        due_date: o.due_date!,
        recurrence: o.recurrence || null,
        alert_days_before: o.alert_days_before ?? 30,
        tenant_id,
      }));
      const { error } = await supabase.from("contract_obligations").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} obrigação(ões) criada(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["contract-obligations", contractId] });
      setAiDialogOpen(false);
      resetAiDialog();
    } catch (err: any) {
      console.error("Error saving AI obligations:", err);
      toast.error(err.message || "Erro ao salvar obrigações.");
    } finally {
      setAiSaving(false);
    }
  };

  const [form, setForm] = useState({
    title: "", description: "", obligation_type: "operacional",
    responsible_party: "administradora", due_date: "", recurrence: "",
    alert_days_before: 30,
  });

  const handleCreate = async () => {
    if (!form.title || !form.due_date) return;
    await create.mutateAsync({
      contract_id: contractId,
      ...form,
      recurrence: form.recurrence || undefined,
    });
    setForm({ title: "", description: "", obligation_type: "operacional", responsible_party: "administradora", due_date: "", recurrence: "", alert_days_before: 30 });
    setShowForm(false);
  };

  const isOverdueSoon = (dueDate: string, alertDays: number) => {
    const diff = (new Date(dueDate + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= alertDays && diff > 0;
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {obligations && obligations.length > 0 ? (
        <div className="space-y-2">
          {obligations.map((o) => (
            <div key={o.id} className="rounded-lg border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium truncate">{o.title}</p>
                  {isOverdueSoon(o.due_date, o.alert_days_before) && o.status === "pendente" && (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="secondary" className={`text-[10px] ${obligationStatusColors[o.status] ?? ""}`}>
                    {obligationStatusLabels[o.status] ?? o.status}
                  </Badge>
                </div>
              </div>
              {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(o.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                <Badge variant="outline" className="text-[10px]">{obligationTypeLabels[o.obligation_type] ?? o.obligation_type}</Badge>
                <Badge variant="outline" className="text-[10px]">{responsiblePartyLabels[o.responsible_party] ?? o.responsible_party}</Badge>
                {o.recurrence && <Badge variant="outline" className="text-[10px]">{recurrenceLabels[o.recurrence]}</Badge>}
              </div>
              {o.status === "pendente" && (
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => complete.mutate({ id: o.id, contractId })}>
                    <CheckSquare className="h-3 w-3 mr-1" /> Cumprida
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => remove.mutate({ id: o.id, contractId })}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma obrigação cadastrada.</p>
      )}

      {!showForm ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Obrigação
          </Button>
          <Button variant="outline" size="sm" onClick={() => { resetAiDialog(); setAiDialogOpen(true); }}>
            <Sparkles className="h-4 w-4 mr-1" /> Extrair com IA
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold">Nova Obrigação</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input placeholder="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <Select value={form.obligation_type} onValueChange={(v) => setForm({ ...form, obligation_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(obligationTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.responsible_party} onValueChange={(v) => setForm({ ...form, responsible_party: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(responsiblePartyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.recurrence || "nenhuma"} onValueChange={(v) => setForm({ ...form, recurrence: v === "nenhuma" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Recorrência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem recorrência</SelectItem>
                {Object.entries(recurrenceLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Alerta (dias antes)" value={form.alert_days_before} onChange={(e) => setForm({ ...form, alert_days_before: Number(e.target.value) })} />
          </div>
          <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={create.isPending}>Salvar</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* AI Obligation Extraction Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={(v) => { if (!v) resetAiDialog(); setAiDialogOpen(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Extrair Obrigações com IA
            </DialogTitle>
            <DialogDescription>
              Envie o PDF do contrato para extrair obrigações automaticamente.
            </DialogDescription>
          </DialogHeader>

          {aiStep === "upload" && (
            <div className="space-y-4 py-2">
              <input ref={aiFileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setAiFile(e.target.files?.[0] ?? null)} />
              {aiFile ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Upload className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm break-all flex-1">{aiFile.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAiFile(null)}>Remover</Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => aiFileRef.current?.click()}
                >
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancelar</Button>
                <Button disabled={!aiFile} onClick={handleAiExtract}>
                  <Sparkles className="mr-2 h-4 w-4" /> Extrair Obrigações
                </Button>
              </div>
            </div>
          )}

          {aiStep === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">{aiProgress}</p>
            </div>
          )}

          {aiStep === "preview" && (
            <div className="space-y-4 py-2">
              <ObligationPreviewPanel obligations={aiObligations} onChange={setAiObligations} />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => { setAiDialogOpen(false); resetAiDialog(); }}>Cancelar</Button>
                <Button onClick={handleAiSave} disabled={aiSaving}>
                  {aiSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Salvar {aiObligations.filter(o => o.selected !== false).length} Obrigação(ões)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
