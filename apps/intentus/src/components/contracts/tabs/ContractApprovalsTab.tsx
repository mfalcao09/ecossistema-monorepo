import { useState } from "react";
import { useContractApprovals, useCreateApprovalSteps, useDecideApproval } from "@/hooks/useContractApprovals";
import { usePeopleForSelect } from "@/hooks/useContracts";
import { approvalStatusLabels, approvalStatusColors } from "@/lib/clmSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Plus, UserCheck } from "lucide-react";

interface Props {
  contractId: string;
}

export function ContractApprovalsTab({ contractId }: Props) {
  const { data: approvals, isLoading } = useContractApprovals(contractId);
  const createSteps = useCreateApprovalSteps();
  const decide = useDecideApproval();
  const { data: people } = usePeopleForSelect();

  const [newSteps, setNewSteps] = useState<{ step_name: string; approver_id: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [decideId, setDecideId] = useState<string | null>(null);
  const [comments, setComments] = useState("");

  const addStep = () => setNewSteps((s) => [...s, { step_name: "", approver_id: "" }]);
  const updateStep = (i: number, field: string, value: string) =>
    setNewSteps((s) => s.map((st, idx) => (idx === i ? { ...st, [field]: value } : st)));
  const removeStep = (i: number) => setNewSteps((s) => s.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    const valid = newSteps.filter((s) => s.step_name && s.approver_id);
    if (valid.length === 0) return;
    await createSteps.mutateAsync({ contractId, steps: valid });
    setNewSteps([]);
    setShowAdd(false);
  };

  const handleDecide = async (id: string, status: "aprovado" | "rejeitado") => {
    await decide.mutateAsync({ id, status, comments, contractId });
    setDecideId(null);
    setComments("");
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const hasSteps = approvals && approvals.length > 0;

  return (
    <div className="space-y-4">
      {hasSteps ? (
        <div className="space-y-2">
          {approvals.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{a.step_name}</p>
                <p className="text-xs text-muted-foreground">Aprovador: {a.approver_id.slice(0, 8)}...</p>
                {a.comments && <p className="text-xs text-muted-foreground mt-1 italic">"{a.comments}"</p>}
              </div>
              <Badge variant="secondary" className={`${approvalStatusColors[a.status] ?? ""}`}>
                {approvalStatusLabels[a.status] ?? a.status}
              </Badge>
              {a.status === "pendente" && (
                <div className="flex gap-1">
                  {decideId === a.id ? (
                    <div className="flex flex-col gap-1">
                      <Textarea
                        placeholder="Comentário (opcional)"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="text-xs h-16 w-48"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" className="h-6 text-xs" onClick={() => handleDecide(a.id, "aprovado")} disabled={decide.isPending}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => handleDecide(a.id, "rejeitado")} disabled={decide.isPending}>
                          <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDecideId(a.id)}>
                      <UserCheck className="h-3 w-3 mr-1" /> Decidir
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cadeia de aprovação configurada.</p>
      )}

      {!showAdd ? (
        <Button variant="outline" size="sm" onClick={() => { setShowAdd(true); addStep(); }}>
          <Plus className="h-4 w-4 mr-1" /> Criar Cadeia de Aprovação
        </Button>
      ) : (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold">Nova Cadeia de Aprovação</h4>
          {newSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold w-6">{i + 1}.</span>
              <Input
                placeholder="Nome da etapa"
                value={s.step_name}
                onChange={(e) => updateStep(i, "step_name", e.target.value)}
                className="flex-1"
              />
              <Select value={s.approver_id} onValueChange={(v) => updateStep(i, "approver_id", v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Aprovador" /></SelectTrigger>
                <SelectContent>
                  {people?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStep(i)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-3 w-3 mr-1" /> Etapa</Button>
            <Button size="sm" onClick={handleCreate} disabled={createSteps.isPending}>Salvar</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewSteps([]); }}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
