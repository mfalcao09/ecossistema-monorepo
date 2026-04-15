import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, Plus, FileX, ArrowRight, Calculator, Eye, AlertTriangle, UserCheck } from "lucide-react";
import {
  useTerminations,
  useCreateTermination,
  terminationStatusLabels,
  terminationStatusColors,
  terminationTransitions,
  useUpdateTerminationStatus,
} from "@/hooks/useTerminations";
import { useContracts } from "@/hooks/useContracts";
import { useContractRenewals } from "@/hooks/useContractRenewals";
import { useInspections, useInspectionItems } from "@/hooks/useInspections";
import { InspectionComparison } from "@/components/inspections/InspectionComparison";
import { contractTypeLabels } from "@/lib/contractSchema";
import { format } from "date-fns";
import { TerminationCalcDialog } from "@/components/contracts/TerminationCalcDialog";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function CompareInspectionsButton({ contractId, exitInspectionId }: { contractId: string; exitInspectionId: string }) {
  const [open, setOpen] = useState(false);
  const { data: inspections } = useInspections();
  const entryInspection = inspections?.find((i: any) => i.contract_id === contractId && i.inspection_type === "entrada");
  const { data: entryItems = [] } = useInspectionItems(entryInspection?.id);
  const { data: exitItems = [] } = useInspectionItems(exitInspectionId);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eye className="h-3 w-3 mr-1" /> Comparar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparativo: Vistoria de Entrada × Saída</DialogTitle>
          </DialogHeader>
          <InspectionComparison
            entryItems={entryItems as any}
            exitItems={exitItems as any}
            entryDate={entryInspection?.scheduled_date}
            exitDate={null}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Terminations() {
  const [search, setSearch] = useState("");
  const { data: terminations = [], isLoading } = useTerminations();
  const { data: allContracts = [] } = useContracts({});
  const { data: renewals = [] } = useContractRenewals();
  const { data: profiles = [] } = useProfiles();
  const updateStatus = useUpdateTerminationStatus();
  const createTermination = useCreateTermination();

  const [newTermOpen, setNewTermOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [noticeDate, setNoticeDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [requestedBy, setRequestedBy] = useState("");

  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTermination, setCalcTermination] = useState<typeof terminations[0] | null>(null);

  const activeContracts = allContracts.filter((c: any) => c.status === "ativo");

  const now = new Date();
  const expiredWithoutAction = allContracts.filter((c: any) => {
    if (c.status !== "ativo" || !c.end_date) return false;
    if (new Date(c.end_date) >= now) return false;
    const hasTermination = terminations.some((t) => t.contract_id === c.id);
    const hasRenewal = renewals.some((r: any) => r.contract_id === c.id);
    return !hasTermination && !hasRenewal;
  });

  const filtered = terminations.filter((t) => {
    const title = t.contracts?.properties?.title || "";
    return title.toLowerCase().includes(search.toLowerCase());
  });

  function handleStatusChange(term: typeof terminations[0], newStatus: string) {
    if (newStatus === "calculo_multa") {
      setCalcTermination(term);
      setCalcOpen(true);
      return;
    }
    updateStatus.mutate({
      id: term.id,
      fromStatus: term.status,
      toStatus: newStatus,
      notes: `Status alterado de ${terminationStatusLabels[term.status]} para ${terminationStatusLabels[newStatus]}`,
    });
  }

  function handleCreateTermination() {
    if (!selectedContractId) return;
    createTermination.mutate(
      { contract_id: selectedContractId, notice_date: noticeDate || undefined, requested_by_party: requestedBy || undefined },
      {
        onSuccess: () => {
          setNewTermOpen(false);
          setSelectedContractId("");
          setNoticeDate(new Date().toISOString().split("T")[0]);
          setRequestedBy("");
        },
      }
    );
  }

  function getCalcContractData(term: typeof terminations[0]) {
    const contract = allContracts.find((c: any) => c.id === term.contract_id) as any;
    return {
      monthly_value: contract?.monthly_value ? Number(contract.monthly_value) : undefined,
      start_date: contract?.start_date || undefined,
      end_date: contract?.end_date || undefined,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Rescisões</h1>
          <p className="text-muted-foreground text-sm">Gerencie os processos de rescisão contratual</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => setNewTermOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Rescisão
        </Button>
      </div>

      {expiredWithoutAction.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Contratos vencidos sem rescisão
            <Badge variant="destructive" className="text-xs">{expiredWithoutAction.length}</Badge>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm mb-3">Os contratos abaixo já venceram e não possuem processo de rescisão nem renovação.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredWithoutAction.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.properties?.title || "—"}</TableCell>
                    <TableCell>{contractTypeLabels[c.contract_type] || c.contract_type}</TableCell>
                    <TableCell>{c.end_date ? format(new Date(c.end_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedContractId(c.id);
                          setNewTermOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Iniciar Rescisão
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Tipo Contrato</TableHead>
                <TableHead>Partes</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aviso Prévio</TableHead>
                <TableHead>Multa/Saldo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <FileX className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhum processo de rescisão em andamento.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((term) => {
                  const nextStatuses = terminationTransitions[term.status] || [];
                  const parties = term.contracts?.contract_parties || [];
                  return (
                    <TableRow key={term.id}>
                      <TableCell className="font-medium">{term.contracts?.properties?.title || "—"}</TableCell>
                      <TableCell>{contractTypeLabels[term.contracts?.contract_type || ""] || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parties.slice(0, 2).map((p: any) => (
                            <Badge key={p.id} variant="secondary" className="text-xs">{p.people?.name || "—"}</Badge>
                          ))}
                          {parties.length > 2 && <Badge variant="outline" className="text-xs">+{parties.length - 2}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={terminationStatusColors[term.status]}>{terminationStatusLabels[term.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={term.assigned_to || ""}
                          onValueChange={(v) => {
                            const val = v === "__none__" ? null : v;
                            supabase.from("contract_terminations").update({ assigned_to: val }).eq("id", term.id).then(({ error }) => {
                              if (error) toast.error(error.message);
                              else toast.success("Responsável atualizado!");
                            });
                          }}
                        >
                          <SelectTrigger className="w-[150px] h-8 text-xs">
                            <SelectValue placeholder="Atribuir..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhum</SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{term.notice_date ? format(new Date(term.notice_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{term.penalty_value ? `R$ ${Number(term.penalty_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(term.status === "calculo_multa" || term.penalty_value) && (
                            <Button variant="ghost" size="sm" onClick={() => { setCalcTermination(term); setCalcOpen(true); }}>
                              <Calculator className="h-3 w-3 mr-1" /> Cálculo
                            </Button>
                          )}
                          {term.exit_inspection_id && (
                            <CompareInspectionsButton contractId={term.contract_id} exitInspectionId={term.exit_inspection_id} />
                          )}
                          {nextStatuses.length > 0 ? (
                            <Select onValueChange={(v) => handleStatusChange(term, v)}>
                              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Avançar para..." /></SelectTrigger>
                              <SelectContent>
                                {nextStatuses.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3" />{terminationStatusLabels[s]}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">Finalizado</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nova Rescisão Dialog */}
      <Dialog open={newTermOpen} onOpenChange={setNewTermOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Rescisão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contrato *</Label>
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {activeContracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.properties?.title || "Sem imóvel"} — {contractTypeLabels[c.contract_type] || c.contract_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data do Aviso Prévio</Label>
              <Input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Solicitado por</Label>
              <Select value={requestedBy} onValueChange={setRequestedBy}>
                <SelectTrigger><SelectValue placeholder="Quem solicitou?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="locatario">Locatário</SelectItem>
                  <SelectItem value="proprietario">Proprietário</SelectItem>
                  <SelectItem value="acordo_mutuo">Acordo Mútuo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTermOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTermination} disabled={!selectedContractId || createTermination.isPending}>
              Iniciar Rescisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calc Dialog */}
      {calcTermination && (
        <TerminationCalcDialog
          open={calcOpen}
          onOpenChange={setCalcOpen}
          terminationId={calcTermination.id}
          contractData={getCalcContractData(calcTermination)}
          noticeDate={calcTermination.notice_date}
          propertyTitle={calcTermination.contracts?.properties?.title || "—"}
          onSaved={() => {
            if (calcTermination.status === "vistoria_saida") {
              updateStatus.mutate({
                id: calcTermination.id,
                fromStatus: calcTermination.status,
                toStatus: "calculo_multa",
                notes: "Cálculo rescisório realizado",
              });
            }
          }}
        />
      )}
    </div>
  );
}
