import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Sparkles, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft,
  FileText, Loader2, Shield, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { indexTypeLabels } from "@/hooks/useRentAdjustments";
import { extractTextFromPdf } from "@/lib/pdfTextExtractor";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract: any;
  onSuccess?: () => void;
}

interface ExtractedData {
  new_end_date?: string;
  new_value?: number;
  adjustment_index?: string;
  adjustment_pct?: number;
  addendum_number?: string;
  effective_date?: string;
  modified_clauses?: string[];
  risk_flags?: string[];
  risk_score?: number;
  summary?: string;
}

export function RenovacaoRealizadaDialog({ open, onOpenChange, contract, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [aiRawOutput, setAiRawOutput] = useState<any>(null);

  // Step 2 fields
  const [newEndDate, setNewEndDate] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adjustmentIndex, setAdjustmentIndex] = useState("igpm");
  const [adjustmentPct, setAdjustmentPct] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setFile(null);
    setAnalyzing(false);
    setExtracted(null);
    setAiRawOutput(null);
    setNewEndDate("");
    setNewValue("");
    setAdjustmentIndex("igpm");
    setAdjustmentPct("");
    setEffectiveDate("");
    setNotes("");
    setSubmitting(false);
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    try {
      let text = "";
      let pdfBase64: string | null = null;

      if (file.type === "application/pdf") {
        text = await extractTextFromPdf(file);
        // Fallback: if text extraction failed (scanned PDF), send as base64
        if (text.trim().length < 50) {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          pdfBase64 = btoa(binary);
          text = "";
        }
      } else {
        // DOCX / TXT: read as text
        text = await file.text();
      }

      if (!pdfBase64 && text.trim().length < 50) {
        toast.error("Não foi possível extrair texto do arquivo. Tente um PDF pesquisável ou escaneado.");
        setAnalyzing(false);
        return;
      }

      const contractContext = contract
        ? `Contrato: ${contract.properties?.title || ""}, Vigência: ${contract.start_date || ""} a ${contract.end_date || ""}, Valor atual: R$ ${contract.monthly_value || 0}`
        : "";

      const { data, error } = await supabase.functions.invoke("parse-addendum-ai", {
        body: {
          addendum_text: text || undefined,
          pdf_base64: pdfBase64 || undefined,
          contract_context: contractContext,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao analisar o aditivo com IA.");
        setAnalyzing(false);
        return;
      }

      const ext: ExtractedData = data.data;
      setExtracted(ext);
      setAiRawOutput(data.raw);

      // Pre-fill form
      if (ext.new_end_date) setNewEndDate(ext.new_end_date);
      if (ext.new_value) setNewValue(String(ext.new_value));
      if (ext.adjustment_index) setAdjustmentIndex(ext.adjustment_index);
      if (ext.adjustment_pct) setAdjustmentPct(String(ext.adjustment_pct));
      if (ext.effective_date) setEffectiveDate(ext.effective_date);
      if (ext.summary) setNotes(ext.summary);

      setStep(2);
    } catch (err: any) {
      toast.error("Erro ao processar arquivo: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm() {
    if (!newEndDate) {
      toast.error("Informe a nova data de vigência.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      // 1. Upload file to contract-documents bucket
      let filePath: string | null = null;
      let documentId: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        filePath = `${tenant_id}/${contract.id}/aditivo_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("contract-documents")
          .upload(filePath, file, { upsert: false });
        if (upErr) throw upErr;

        // 2. Insert into contract_documents
        const { data: docData, error: docErr } = await supabase
          .from("contract_documents")
          .insert({
            contract_id: contract.id,
            title: extracted?.addendum_number || file.name,
            document_type: "aditivo",
            status: "assinado",
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id,
            tenant_id,
          } as any)
          .select("id")
          .single();
        if (docErr) throw docErr;
        documentId = docData?.id ?? null;
      }

      const numNewValue = newValue ? parseFloat(newValue) : null;
      const numAdjPct = adjustmentPct ? parseFloat(adjustmentPct) : 0;

      // 3. Insert contract_renewal with status "formalizada"
      const { error: rnErr } = await supabase
        .from("contract_renewals" as any)
        .insert({
          contract_id: contract.id,
          previous_end_date: contract.end_date,
          new_end_date: newEndDate,
          previous_value: Number(contract.monthly_value || 0),
          new_value: numNewValue,
          adjustment_index: adjustmentIndex,
          adjustment_pct: numAdjPct,
          renewal_term_months: 12,
          checklist: "[]",
          notes,
          status: "formalizada",
          addendum_document_id: documentId,
          addendum_file_path: filePath,
          addendum_title: extracted?.addendum_number || file?.name || "Aditivo",
          ai_extracted: !!extracted,
          ai_raw_output: aiRawOutput,
          ai_risk_score: extracted?.risk_score ?? null,
          ai_risk_flags: extracted?.risk_flags ? JSON.stringify(extracted.risk_flags) : null,
          formalized_at: new Date().toISOString(),
          formalized_by: user.id,
          created_by: user.id,
          tenant_id,
        } as any);
      if (rnErr) throw rnErr;

      // 4. Update contract end_date (and monthly_value if changed)
      const contractUpdate: any = { end_date: newEndDate };
      if (numNewValue && numNewValue !== Number(contract.monthly_value)) {
        contractUpdate.monthly_value = numNewValue;
      }
      const { error: ctErr } = await supabase
        .from("contracts")
        .update(contractUpdate)
        .eq("id", contract.id);
      if (ctErr) throw ctErr;

      // 5. Audit trail
      await supabase.from("contract_audit_trail" as any).insert({
        contract_id: contract.id,
        action: "renovacao_formalizada",
        performer_name: user.email || "Usuário",
        performed_by: user.id,
        tenant_id,
        details: {
          previous_end_date: contract.end_date,
          new_end_date: newEndDate,
          previous_value: contract.monthly_value,
          new_value: numNewValue,
          adjustment_index: adjustmentIndex,
          adjustment_pct: numAdjPct,
          ai_extracted: !!extracted,
          addendum_title: extracted?.addendum_number || file?.name,
          ai_risk_score: extracted?.risk_score,
        },
      } as any);

      // 6. Property price history if value changed
      if (numNewValue && numNewValue !== Number(contract.monthly_value)) {
        const { data: ct } = await supabase
          .from("contracts")
          .select("property_id")
          .eq("id", contract.id)
          .maybeSingle();
        if (ct?.property_id) {
          await supabase.from("property_price_history").insert({
            property_id: ct.property_id,
            price_type: "rental_price",
            old_value: Number(contract.monthly_value || 0),
            new_value: numNewValue,
            changed_by: user.id,
            notes: `Renovação formalizada – ${extracted?.addendum_number || "Aditivo"}`,
            tenant_id,
          } as any);
          await supabase
            .from("properties")
            .update({ rental_price: numNewValue })
            .eq("id", ct.property_id);
        }
      }

      toast.success("Renovação formalizada com sucesso! Aditivo arquivado no contrato.");

      // Fire notification
      createNotification({
        userId: user.id,
        title: "Renovação realizada",
        message: "Contrato foi renovado e aditivo foi formalizado",
        category: "contrato",
        referenceType: "contract",
        referenceId: contract.id,
      });

      onSuccess?.();
      handleClose(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao formalizar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const prevValue = Number(contract?.monthly_value || 0);
  const parsedNewValue = newValue ? parseFloat(newValue) : null;
  const valueDiff = parsedNewValue ? parsedNewValue - prevValue : 0;
  const valuePct = prevValue > 0 && parsedNewValue ? ((parsedNewValue - prevValue) / prevValue * 100).toFixed(2) : null;

  const riskScore = extracted?.risk_score ?? null;
  const riskColor = riskScore === null ? "" : riskScore >= 80 ? "text-green-600" : riskScore >= 60 ? "text-amber-600" : "text-red-600";
  const riskBg = riskScore === null ? "" : riskScore >= 80 ? "bg-green-50 border-green-200" : riskScore >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Renovação Realizada
          </DialogTitle>
          {contract && (
            <p className="text-sm text-muted-foreground">{contract.properties?.title || "Contrato"}</p>
          )}
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? "bg-primary text-primary-foreground" :
                step > s ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              <span className={`text-xs hidden sm:inline ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s === 1 ? "Upload" : s === 2 ? "Dados" : "Confirmar"}
              </span>
              {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <Separator />

        {/* ─── STEP 1: Upload ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faça o upload do aditivo assinado. A IA irá extrair automaticamente a nova data de vigência, valor e índice de reajuste.
            </p>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-green-400 bg-green-50" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-green-600" />
                  <p className="font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    Trocar arquivo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="font-medium">Arraste ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX — máx. 20MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex items-start gap-3 rounded-lg border bg-primary/5 p-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Análise por IA</p>
                <p className="text-muted-foreground text-xs">A IA extrai nova vigência, valor, índice de reajuste e gera um score de conformidade jurídica automaticamente.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic">
              Sem arquivo? Clique em "Preencher manualmente" para inserir os dados diretamente.
            </p>
          </div>
        )}

        {/* ─── STEP 2: Data review ─── */}
        {step === 2 && (
          <div className="space-y-4">
            {extracted && (
              <div className={`rounded-lg border p-3 space-y-1 ${riskBg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1">
                    <Shield className="h-4 w-4" /> Score de Conformidade Jurídica
                  </span>
                  <span className={`text-lg font-bold ${riskColor}`}>{riskScore}/100</span>
                </div>
                <Progress value={riskScore ?? 0} className="h-2" />
                {extracted.summary && (
                  <p className="text-xs text-muted-foreground mt-1">{extracted.summary}</p>
                )}
                {extracted.addendum_number && (
                  <Badge variant="outline" className="text-xs">{extracted.addendum_number}</Badge>
                )}
                {extracted.risk_flags && extracted.risk_flags.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {extracted.risk_flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-primary/70 flex items-center gap-1 mt-1">
                  <Sparkles className="h-3 w-3" /> Dados pré-preenchidos pela IA — revise antes de confirmar.
                </p>
              </div>
            )}

            {!extracted && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/30 p-3">
                <AlertTriangle className="h-4 w-4" />
                Preenchimento manual — sem análise de IA.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nova Data de Vigência *</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Assinatura</Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Novo Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={String(prevValue)}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Deixe vazio se não houve reajuste de valor</p>
              </div>
              <div className="space-y-1.5">
                <Label>Índice de Reajuste</Label>
                <Select value={adjustmentIndex} onValueChange={setAdjustmentIndex}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(indexTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Percentual de Reajuste (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentPct}
                onChange={(e) => setAdjustmentPct(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {extracted?.modified_clauses && extracted.modified_clauses.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cláusulas identificadas pela IA</Label>
                <div className="flex flex-wrap gap-1">
                  {extracted.modified_clauses.map((cl, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{cl}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 3: Confirm ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Resumo das alterações que serão aplicadas ao contrato:</p>

            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Vigência anterior</p>
                        <p className="font-medium">{contract?.end_date ? format(new Date(contract.end_date), "dd/MM/yyyy") : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Nova vigência</p>
                        <p className="font-bold text-green-700">{newEndDate ? format(new Date(newEndDate), "dd/MM/yyyy") : "—"}</p>
                      </div>
                      {parsedNewValue && (
                        <>
                          <div>
                            <p className="text-muted-foreground text-xs">Valor anterior</p>
                            <p className="font-medium">{fmt(prevValue)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Novo valor</p>
                            <p className="font-bold text-green-700">
                              {fmt(parsedNewValue)}
                              {valuePct && <span className="text-xs ml-1 text-green-600">(+{valuePct}%)</span>}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {adjustmentPct && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        Reajuste: {indexTypeLabels[adjustmentIndex] || adjustmentIndex} — {adjustmentPct}%
                      </div>
                    )}

                    {file && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        Aditivo archivado: <span className="font-medium">{file.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 text-sm">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">O sistema irá:</p>
              <ul className="space-y-1 text-sm">
                {file && <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Arquivar o aditivo na aba de Documentos do contrato</li>}
                <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Atualizar a data de vigência do contrato</li>
                {parsedNewValue && <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Atualizar o valor mensal do contrato e histórico de preços</li>}
                <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Registrar no histórico de auditoria do contrato</li>
                {extracted && <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Salvar score de conformidade da IA ({extracted.risk_score}/100)</li>}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancelar
          </Button>

          {step === 1 && (
            <>
              {file ? (
                <Button onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analisando...</> : <><Sparkles className="h-4 w-4 mr-1" /> Analisar com IA</>}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Preencher manualmente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}

          {step === 2 && (
            <Button onClick={() => {
              if (!newEndDate) { toast.error("Informe a nova data de vigência."); return; }
              setStep(3);
            }}>
              Revisar <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 3 && (
            <Button onClick={handleConfirm} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Formalizando...</> : <><CheckCircle className="h-4 w-4 mr-1" /> Confirmar e Formalizar</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
