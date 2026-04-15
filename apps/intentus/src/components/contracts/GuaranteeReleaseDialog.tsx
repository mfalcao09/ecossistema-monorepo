import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Check, FileText, AlertTriangle, KeyRound } from "lucide-react";
import type { ChecklistItem, GuaranteeRelease } from "@/hooks/useGuaranteeRelease";
import type { BusinessRules } from "@/hooks/useGuaranteeTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: GuaranteeRelease;
  contractData: {
    propertyTitle: string;
    monthlyValue: number;
    guaranteeType: string;
    guaranteeDetails: string;
    guaranteePolicyNumber: string;
  };
  businessRules?: BusinessRules;
  onSave: (data: { checklist: ChecklistItem[]; notes: string; refund_amount: number; status: string }) => void;
  onComplete: (data: { refund_amount: number; notes: string }) => void;
  isSaving: boolean;
}

export function GuaranteeReleaseDialog({
  open, onOpenChange, release, contractData, businessRules, onSave, onComplete, isSaving,
}: Props) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(release.checklist || []);
  const [notes, setNotes] = useState(release.notes || "");
  const [refundAmount, setRefundAmount] = useState(release.refund_amount || 0);

  useEffect(() => {
    setChecklist(release.checklist || []);
    setNotes(release.notes || "");
    setRefundAmount(release.refund_amount || 0);
  }, [release]);

  const doneCount = checklist.filter((i) => i.done).length;
  const requiredCount = checklist.filter((i) => i.required).length;
  const requiredDone = checklist.filter((i) => i.required && i.done).length;
  const allRequiredDone = requiredCount > 0 && requiredDone === requiredCount;

  const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  function toggleItem(idx: number) {
    setChecklist((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, done: !item.done, done_at: !item.done ? new Date().toISOString() : null }
          : item
      )
    );
  }

  function updateItemNotes(idx: number, value: string) {
    setChecklist((prev) => prev.map((item, i) => (i === idx ? { ...item, notes: value } : item)));
  }

  function handleSave() {
    onSave({
      checklist,
      notes,
      refund_amount: refundAmount,
      status: doneCount > 0 ? "em_andamento" : "pendente",
    });
  }

  function handleComplete() {
    onComplete({ refund_amount: refundAmount, notes });
  }

  const documentGroups = businessRules?.document_groups || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Liberação de Garantia
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 pb-2">
            {/* Contract header */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Imóvel:</span>
                    <p className="font-medium">{contractData.propertyTitle}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor Aluguel:</span>
                    <p className="font-medium">{fmt(contractData.monthlyValue)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo de Garantia:</span>
                    <p className="font-medium">{release.guarantee_type_name || contractData.guaranteeType || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor da Garantia:</span>
                    <p className="font-medium">{fmt(release.guarantee_value)}</p>
                  </div>
                  {contractData.guaranteePolicyNumber && (
                    <div>
                      <span className="text-muted-foreground">Nº Apólice/Caução:</span>
                      <p className="font-medium">{contractData.guaranteePolicyNumber}</p>
                    </div>
                  )}
                  {contractData.guaranteeDetails && (
                    <div>
                      <span className="text-muted-foreground">Detalhes:</span>
                      <p className="font-medium text-xs">{contractData.guaranteeDetails}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Checklist de Liberação</h3>
                <Badge variant="outline" className="text-xs">
                  {doneCount}/{checklist.length} etapas
                </Badge>
              </div>
              {checklist.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma etapa configurada para este tipo de garantia.
                </p>
              ) : (
                <div className="space-y-3">
                  {checklist.map((item, idx) => (
                    <Card key={idx} className={item.done ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900" : ""}>
                      <CardContent className="pt-3 pb-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={item.done}
                            onCheckedChange={() => toggleItem(idx)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                                {item.order}. {item.name}
                              </span>
                              {item.required && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Obrigatória</Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                            <Input
                              placeholder="Observação desta etapa..."
                              value={item.notes}
                              onChange={(e) => updateItemNotes(idx, e.target.value)}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          {item.done && <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Document groups */}
            {documentGroups.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos Necessários (Referência)
                  </h3>
                  <div className="grid gap-3">
                    {documentGroups.map((group, idx) => (
                      <Card key={idx} className="bg-muted/30">
                        <CardContent className="pt-3 pb-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">{group.label} ({group.party_role})</p>
                          <ul className="list-disc list-inside text-xs space-y-0.5">
                            {group.documents.map((doc, di) => (
                              <li key={di}>{doc}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Refund amount */}
            <div className="space-y-1.5">
              <Label>Valor de Devolução (se aplicável)</Label>
              <Input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Valor a ser devolvido ao locatário (ex: caução com correção monetária).
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observações sobre o processo de liberação..." />
            </div>

            {/* Summary */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4 pb-4">
                <h4 className="text-sm font-semibold mb-2">Resumo</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Progresso:</span>
                    <p className="font-medium">{doneCount}/{checklist.length} etapas concluídas</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Obrigatórias:</span>
                    <p className="font-medium">{requiredDone}/{requiredCount} concluídas</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor da Garantia:</span>
                    <p className="font-medium">{fmt(release.guarantee_value)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor de Devolução:</span>
                    <p className="font-medium">{fmt(refundAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!allRequiredDone && requiredCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Conclua todas as etapas obrigatórias para finalizar a liberação.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="secondary" onClick={handleSave} disabled={isSaving}>Salvar Progresso</Button>
          <Button
            onClick={handleComplete}
            disabled={!allRequiredDone || isSaving}
          >
            <Check className="h-4 w-4 mr-1" /> Concluir Liberação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
