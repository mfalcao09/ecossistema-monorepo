import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, Eye, KeyRound } from "lucide-react";
import {
  useTerminations,
  terminationStatusLabels,
  terminationStatusColors,
} from "@/hooks/useTerminations";
import { useContracts } from "@/hooks/useContracts";
import { useGuaranteeReleases, useCreateGuaranteeRelease, useUpdateGuaranteeRelease, useCompleteGuaranteeRelease } from "@/hooks/useGuaranteeRelease";
import type { GuaranteeRelease, ChecklistItem } from "@/hooks/useGuaranteeRelease";
import { useGuaranteeTypes as useGuaranteeTypesHook } from "@/hooks/useGuaranteeTypes";
import type { BusinessRules } from "@/hooks/useGuaranteeTypes";
import { GuaranteeReleaseDialog } from "@/components/contracts/GuaranteeReleaseDialog";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { format } from "date-fns";

export default function GuaranteeReleases() {
  const { data: terminations = [], isLoading: termLoading } = useTerminations();
  const { data: allContracts = [] } = useContracts({});
  const { data: releases = [], isLoading: relLoading } = useGuaranteeReleases();
  const { data: guaranteeTypes = [] } = useGuaranteeTypesHook();
  const createRelease = useCreateGuaranteeRelease();
  const updateRelease = useUpdateGuaranteeRelease();
  const completeRelease = useCompleteGuaranteeRelease();
  const { data: profiles = [] } = useProfiles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<GuaranteeRelease | null>(null);

  const isLoading = termLoading || relLoading;
  const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const eligibleStatuses = ["quitacao_pendencias", "termo_entrega"];
  const releaseTermIds = new Set(releases.map((r) => r.termination_id));
  const eligibleTerminations = terminations.filter(
    (t) => eligibleStatuses.includes(t.status) && !releaseTermIds.has(t.id)
  );

  const inProgressReleases = releases.filter((r) => r.status === "pendente" || r.status === "em_andamento");
  const completedReleases = releases.filter((r) => r.status === "concluida");

  function getContractForTermination(termination: any) {
    return allContracts.find((c: any) => c.id === termination.contract_id) as any;
  }

  function handleStartRelease(termination: any) {
    const contract = getContractForTermination(termination);
    const guaranteeTypeName = contract?.guarantee_type || "";
    const guaranteeValue = Number(contract?.guarantee_value || 0);

    let checklist: ChecklistItem[] = [];
    if (contract?.guarantee_type_id) {
      const gt = guaranteeTypes.find((g) => g.id === contract.guarantee_type_id);
      const rules = (gt?.business_rules || {}) as BusinessRules;
      if (rules.validation_steps && Array.isArray(rules.validation_steps)) {
        checklist = rules.validation_steps.map((step) => ({
          order: step.order,
          name: step.name,
          description: step.description,
          required: step.required,
          done: false,
          done_at: null,
          notes: "",
        }));
      }
    }

    createRelease.mutate({
      termination_id: termination.id,
      contract_id: termination.contract_id,
      guarantee_type_id: contract?.guarantee_type_id || null,
      guarantee_type_name: guaranteeTypeName,
      guarantee_value: guaranteeValue,
      checklist,
    });
  }

  function openReleaseDialog(release: GuaranteeRelease) {
    setSelectedRelease(release);
    setDialogOpen(true);
  }

  function getContractDataForRelease(release: GuaranteeRelease) {
    const contract = allContracts.find((c: any) => c.id === release.contract_id) as any;
    return {
      propertyTitle: contract?.properties?.title || "—",
      monthlyValue: Number(contract?.monthly_value || 0),
      guaranteeType: contract?.guarantee_type || "",
      guaranteeDetails: contract?.guarantee_details || "",
      guaranteePolicyNumber: contract?.guarantee_policy_number || "",
    };
  }

  function getBusinessRulesForRelease(release: GuaranteeRelease): BusinessRules | undefined {
    if (!release.guarantee_type_id) return undefined;
    const gt = guaranteeTypes.find((g) => g.id === release.guarantee_type_id);
    return (gt?.business_rules || {}) as BusinessRules;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Liberação de Garantias</h1>
        <p className="text-muted-foreground text-sm">Gerencie a devolução de cauções e liberação de garantias contratuais.</p>
      </div>

      {/* Elegíveis */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Rescisões Elegíveis
          {eligibleTerminations.length > 0 && <Badge variant="secondary" className="ml-1">{eligibleTerminations.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo de Garantia</TableHead>
                  <TableHead>Valor Garantia</TableHead>
                  <TableHead>Status Rescisão</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : eligibleTerminations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Check className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhuma rescisão aguardando liberação de garantia.
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleTerminations.map((term) => {
                    const contract = getContractForTermination(term);
                    return (
                      <TableRow key={term.id}>
                        <TableCell className="font-medium">{term.contracts?.properties?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{contract?.guarantee_type || "—"}</Badge></TableCell>
                        <TableCell>{contract?.guarantee_value ? fmt(Number(contract.guarantee_value)) : "—"}</TableCell>
                        <TableCell><Badge className={terminationStatusColors[term.status]}>{terminationStatusLabels[term.status]}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleStartRelease(term)} disabled={createRelease.isPending}>
                            <KeyRound className="h-3 w-3 mr-1" /> Iniciar Liberação
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Em Andamento */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Processos em Andamento
          {inProgressReleases.length > 0 && <Badge variant="secondary" className="ml-1">{inProgressReleases.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo de Garantia</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressReleases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <KeyRound className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum processo em andamento.
                    </TableCell>
                  </TableRow>
                ) : (
                  inProgressReleases.map((rel) => {
                    const contract = allContracts.find((c: any) => c.id === rel.contract_id) as any;
                    const doneCount = rel.checklist.filter((i) => i.done).length;
                    return (
                      <TableRow key={rel.id}>
                        <TableCell className="font-medium">{contract?.properties?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{rel.guarantee_type_name || "—"}</Badge></TableCell>
                        <TableCell>{fmt(rel.guarantee_value)}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{doneCount}/{rel.checklist.length} etapas</Badge></TableCell>
                        <TableCell>
                          <Select
                            value={rel.assigned_to || ""}
                            onValueChange={(v) => {
                              updateRelease.mutate({ id: rel.id, assigned_to: v === "__none__" ? null : v });
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
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
                        <TableCell><Badge variant={rel.status === "em_andamento" ? "default" : "outline"}>{rel.status === "pendente" ? "Pendente" : "Em Andamento"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openReleaseDialog(rel)}><Eye className="h-3 w-3 mr-1" /> Gerenciar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Concluídos */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" /> Concluídos
          {completedReleases.length > 0 && <Badge variant="secondary" className="ml-1">{completedReleases.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo de Garantia</TableHead>
                  <TableHead>Valor Garantia</TableHead>
                  <TableHead>Valor Devolvido</TableHead>
                  <TableHead>Concluído em</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedReleases.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma liberação concluída ainda.</TableCell></TableRow>
                ) : (
                  completedReleases.map((rel) => {
                    const contract = allContracts.find((c: any) => c.id === rel.contract_id) as any;
                    return (
                      <TableRow key={rel.id}>
                        <TableCell className="font-medium">{contract?.properties?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{rel.guarantee_type_name || "—"}</Badge></TableCell>
                        <TableCell>{fmt(rel.guarantee_value)}</TableCell>
                        <TableCell>{fmt(rel.refund_amount)}</TableCell>
                        <TableCell>{rel.completed_at ? format(new Date(rel.completed_at), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openReleaseDialog(rel)}><Eye className="h-3 w-3 mr-1" /> Ver</Button></TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      {selectedRelease && (
        <GuaranteeReleaseDialog
          open={dialogOpen}
          onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedRelease(null); }}
          release={selectedRelease}
          contractData={getContractDataForRelease(selectedRelease)}
          businessRules={getBusinessRulesForRelease(selectedRelease)}
          onSave={(data) => updateRelease.mutate({ id: selectedRelease.id, ...data }, { onSuccess: () => setDialogOpen(false) })}
          onComplete={(data) => completeRelease.mutate({ id: selectedRelease.id, termination_id: selectedRelease.termination_id, ...data }, { onSuccess: () => { setDialogOpen(false); setSelectedRelease(null); } })}
          isSaving={updateRelease.isPending || completeRelease.isPending}
        />
      )}
    </div>
  );
}
