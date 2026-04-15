import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, ShieldCheck, ShieldAlert, ShieldQuestion, Check, X, Clock, Loader2, FileSearch } from "lucide-react";
import { useDueDiligenceChecks, useCreateDueDiligenceCheck, useUpdateDueDiligenceCheck, useSerproCndCheck, useInfosimplesCrfCheck, checkTypeLabels, ddStatusLabels, ddStatusColors } from "@/hooks/useDueDiligence";
import { usePeople } from "@/hooks/usePeople";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function DueDiligence() {
  const [search, setSearch] = useState("");
  const { data: checks = [], isLoading } = useDueDiligenceChecks();
  const { data: people = [] } = usePeople();
  const createCheck = useCreateDueDiligenceCheck();
  const updateCheck = useUpdateDueDiligenceCheck();
  const serproCnd = useSerproCndCheck();
  const infosimplesCrf = useInfosimplesCrfCheck();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ person_id: "", check_type: "serasa", notes: "" });
  const [consultingId, setConsultingId] = useState<string | null>(null);

  const filtered = checks.filter((c: any) => {
    const name = c.people?.name || "";
    const cpf = c.people?.cpf_cnpj || "";
    return name.toLowerCase().includes(search.toLowerCase()) || cpf.includes(search);
  });

  const statusIcon = (status: string) => {
    if (status === "aprovado") return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (status === "reprovado") return <ShieldAlert className="h-4 w-4 text-red-600" />;
    return <ShieldQuestion className="h-4 w-4 text-muted-foreground" />;
  };

  const summary = {
    total: checks.length,
    pendente: checks.filter((c: any) => c.status === "pendente" || c.status === "em_andamento").length,
    aprovado: checks.filter((c: any) => c.status === "aprovado").length,
    reprovado: checks.filter((c: any) => c.status === "reprovado").length,
  };

  function openNew() {
    setForm({ person_id: "", check_type: "serasa", notes: "" });
    setDialogOpen(true);
  }

  function handleSave() {
    createCheck.mutate({
      person_id: form.person_id,
      check_type: form.check_type,
      notes: form.notes || undefined,
    }, { onSuccess: () => setDialogOpen(false) });
  }

  function handleStatusUpdate(id: string, status: "pendente" | "em_andamento" | "aprovado" | "reprovado" | "inconclusivo") {
    updateCheck.mutate({
      id,
      status,
      checked_at: status !== "pendente" ? new Date().toISOString() : undefined,
    });
  }

  function handleSerproConsult(check: any) {
    const cpfCnpj = check.people?.cpf_cnpj;
    if (!cpfCnpj) return;
    setConsultingId(check.id);
    serproCnd.mutate(
      { cpf_cnpj: cpfCnpj, check_id: check.id, use_trial: false },
      { onSettled: () => setConsultingId(null) }
    );
  }

  const isCndType = (type: string) => ["cnd", "cadin", "divida_ativa", "certidao_negativa"].includes(type);
  const isFgtsType = (type: string) => type === "crf_fgts";

  function handleFgtsConsult(check: any) {
    const cpfCnpj = check.people?.cpf_cnpj?.replace(/\D/g, "");
    if (!cpfCnpj || cpfCnpj.length !== 14) {
      return;
    }
    setConsultingId(check.id);
    infosimplesCrf.mutate(
      { cnpj: cpfCnpj, check_id: check.id },
      { onSettled: () => setConsultingId(null) }
    );
  }

  const fmt = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Due Diligence</h1>
          <p className="text-muted-foreground text-sm">Análise de risco e consultas de crédito/jurídicas das partes envolvidas</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Verificação</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShieldQuestion className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.pendente}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.aprovado}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.reprovado}</p>
                <p className="text-xs text-muted-foreground">Reprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Tipo Consulta</TableHead>
                <TableHead>Negócio Vinculado</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Data Consulta</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <ShieldQuestion className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhuma verificação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.people?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{c.people?.cpf_cnpj || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{checkTypeLabels[c.check_type] || c.check_type}</Badge></TableCell>
                    <TableCell>{c.deal_requests?.properties?.title || "—"}</TableCell>
                    <TableCell>{c.score != null ? <span className="font-mono font-bold">{c.score}</span> : "—"}</TableCell>
                    <TableCell>
                      <Badge className={ddStatusColors[c.status]}>
                        <span className="flex items-center gap-1">{statusIcon(c.status)} {ddStatusLabels[c.status]}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {c.result_summary ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground truncate block cursor-help">{c.result_summary.substring(0, 50)}...</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm"><p className="text-xs">{c.result_summary}</p></TooltipContent>
                        </Tooltip>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{c.checked_at ? fmt(c.checked_at) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {/* SERPRO CND button for CND-type checks */}
                        {isCndType(c.check_type) && c.people?.cpf_cnpj && (c.status === "pendente" || c.status === "em_andamento") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary"
                                disabled={consultingId === c.id}
                                onClick={() => handleSerproConsult(c)}
                              >
                                {consultingId === c.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <FileSearch className="h-3 w-3 mr-1" />
                                )}
                                SERPRO
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Consultar CND automaticamente via API SERPRO</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Infosimples CRF/FGTS button */}
                        {isFgtsType(c.check_type) && c.people?.cpf_cnpj?.replace(/\D/g, "").length === 14 && (c.status === "pendente" || c.status === "em_andamento") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary"
                                disabled={consultingId === c.id}
                                onClick={() => handleFgtsConsult(c)}
                              >
                                {consultingId === c.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <FileSearch className="h-3 w-3 mr-1" />
                                )}
                                FGTS
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Consultar CRF/FGTS automaticamente via Infosimples</TooltipContent>
                          </Tooltip>
                        )}

                        {(c.status === "pendente" || c.status === "em_andamento") && (
                          <>
                            {c.status === "pendente" && (
                              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(c.id, "em_andamento")}>
                                <Clock className="h-3 w-3 mr-1" /> Iniciar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusUpdate(c.id, "aprovado")}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusUpdate(c.id, "reprovado")}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Verificação de Due Diligence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pessoa *</Label>
              <Select value={form.person_id} onValueChange={(v) => setForm({ ...form, person_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a pessoa" /></SelectTrigger>
                <SelectContent>
                  {(people as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.cpf_cnpj ? `(${p.cpf_cnpj})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Consulta *</Label>
              <Select value={form.check_type} onValueChange={(v) => setForm({ ...form, check_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(checkTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.person_id || createCheck.isPending}>Criar Verificação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
