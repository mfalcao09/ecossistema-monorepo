import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { sanitizeContractHtml } from "@/lib/sanitizeHtml";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, FileText, AlertTriangle, Download, Loader2, CheckCircle } from "lucide-react";
import { useContractDraftAI } from "@/hooks/useContractDraftAI";
import { useContracts } from "@/hooks/useContracts";
import { contractTypeLabels } from "@/lib/contractSchema";
import { toast } from "sonner";

interface ContractDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractDraftDialog({ open, onOpenChange }: ContractDraftDialogProps) {
  const { generate, loading, result, reset } = useContractDraftAI();
  const { data: contracts = [] } = useContracts({ status: "rascunho" });

  const [contractId, setContractId] = useState("");
  const [contractType, setContractType] = useState("locacao");
  const [instructions, setInstructions] = useState("");
  const [step, setStep] = useState<"config" | "result">("config");

  function handleClose(o: boolean) {
    if (!o) {
      reset();
      setStep("config");
      setContractId("");
      setInstructions("");
    }
    onOpenChange(o);
  }

  async function handleGenerate() {
    const r = await generate({
      contract_id: contractId && contractId !== "__none__" ? contractId : undefined,
      contract_type: contractId ? undefined : contractType,
      instructions: instructions || undefined,
    });
    if (r) {
      setStep("result");

      // Fire notification
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          createNotification({
            userId: user.id,
            title: "Minuta gerada",
            message: "Contrato foi redigido com sucesso pela IA",
            category: "contrato",
            referenceType: "contract",
            referenceId: contractId && contractId !== "__none__" ? contractId : undefined,
          });
        }
      });
    }
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${result.title}</title>
      <style>body{font-family:Arial,sans-serif;margin:60px;line-height:1.8;color:#000}h1,h2{text-align:center}
      .clause{margin-bottom:20px}p{text-align:justify}</style></head>
      <body>${result.contract_html}</body></html>`
    ], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Contrato exportado!");
  }

  function handleCopyHtml() {
    if (!result) return;
    navigator.clipboard.writeText(result.contract_html);
    toast.success("HTML copiado para a área de transferência!");
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Geração de Contrato por IA
          </DialogTitle>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-5">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">
                  A IA irá redigir um contrato completo com base nos dados do sistema,
                  utilizando a legislação brasileira vigente (Lei 8.245/91, Código Civil)
                  e as cláusulas padrão cadastradas.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Contrato existente (opcional)</Label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contrato para usar seus dados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem contrato específico —</SelectItem>
                    {(contracts as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.properties?.title || "Sem imóvel"} — {c.contract_parties?.[0]?.people?.name || "Sem parte"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se selecionado, a IA usará os dados do contrato para preencher automaticamente o documento.</p>
              </div>

              {!contractId && (
                <div className="space-y-2">
                  <Label>Tipo de Contrato</Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(contractTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Instruções especiais (opcional)</Label>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="Ex: Incluir cláusula de renovação automática, adicionar garantia de fiança, usar prazo determinado de 30 meses..."
                />
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="font-medium">Redigindo contrato com IA...</p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns instantes. A IA está analisando os dados e as cláusulas.</p>
          </div>
        )}

        {step === "result" && result && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{result.title}</p>
                <p className="text-xs text-muted-foreground">{result.clauses_count} cláusulas geradas</p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3 text-primary" />
                Contrato gerado
              </Badge>
            </div>

            {/* Summary */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Resumo executivo</p>
                <p className="text-sm">{result.summary}</p>
              </CardContent>
            </Card>

            {/* Missing fields */}
            {result.missing_fields && result.missing_fields.length > 0 && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="pt-4">
                  <p className="text-xs font-medium flex items-center gap-1 text-warning-foreground mb-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Campos a preencher manualmente:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.missing_fields.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Legal notes */}
            {result.legal_notes && result.legal_notes.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Observações jurídicas:</p>
                  <ul className="space-y-1">
                    {result.legal_notes.map((n, i) => (
                      <li key={i} className="text-xs flex gap-1 text-muted-foreground"><span className="text-primary">•</span>{n}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização:</p>
                <div
                  className="text-xs border rounded p-4 max-h-60 overflow-y-auto bg-background prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(result.contract_html) }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {step === "config" && !loading && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} className="gap-2" disabled={loading}>
                <Sparkles className="h-4 w-4" />
                Gerar Contrato com IA
              </Button>
            </>
          )}
          {step === "result" && result && (
            <>
              <Button variant="outline" onClick={() => { setStep("config"); reset(); }}>
                Nova Geração
              </Button>
              <Button variant="outline" onClick={handleCopyHtml} className="gap-2">
                <FileText className="h-4 w-4" />
                Copiar HTML
              </Button>
              <Button variant="outline" onClick={() => {
                if (!result) return;
                const blob = new Blob([
                  `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${result.title}</title>
                  <style>body{font-family:Arial,sans-serif;margin:60px;line-height:1.8;color:#000}h1,h2{text-align:center}
                  .clause{margin-bottom:20px}p{text-align:justify}</style></head>
                  <body>${result.contract_html}</body></html>`
                ], { type: "text/html;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => URL.revokeObjectURL(url), 10000);
              }} className="gap-2">
                <FileText className="h-4 w-4" />
                Imprimir / PDF
              </Button>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar HTML
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
