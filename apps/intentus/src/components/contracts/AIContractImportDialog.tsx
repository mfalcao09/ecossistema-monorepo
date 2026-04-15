import { useState, useRef } from "react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { createNotification } from "@/hooks/useNotifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContractFormValues } from "@/lib/contractSchema";
import type { PropertyFormValues } from "@/lib/propertySchema";
import type { PersonFormValues } from "@/lib/personSchema";
import { extractTextFromPdf } from "@/lib/pdfTextExtractor";
import type { AIExtractedObligation } from "./ObligationPreviewPanel";

interface AIExtractedParty {
  name: string;
  role: string;
  cpf_cnpj?: string;
}

export interface AIExtractedPerson extends Partial<PersonFormValues> {
  contractRole: string;
  legal_representative_name?: string;
  legal_representative_cpf?: string;
  // Bloco 1 - Qualificação legal
  marital_status?: string;
  marriage_regime?: string;
  profession?: string;
  nationality?: string;
  natural_from?: string;
  rg_issuer?: string;
  // Bloco 1 - Dados bancários
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  bank_account_type?: string;
  pix_key?: string;
  // Bloco 1 - Dados PJ
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  cnae?: string;
  // Representante Legal extras
  legal_representative_email?: string;
  legal_representative_phone?: string;
}

export interface AIInspectionData {
  conducted_date?: string;
  inspector_name?: string;
  notes?: string;
  items: Array<{ room_name: string; item_name: string; condition: string; notes?: string }>;
}

export interface AIPrefillData {
  contractData: Partial<ContractFormValues>;
  parties: AIExtractedParty[];
  clausesSummary: string;
  mainFile: File;
  addendaFiles: File[];
  propertyData: Partial<PropertyFormValues>;
  propertiesData: Array<Partial<PropertyFormValues>>;
  peopleData: AIExtractedPerson[];
  inspectionData: AIInspectionData | null;
  obligationsData: AIExtractedObligation[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (data: AIPrefillData) => void;
}

type Step = "upload" | "processing" | "error";

export function AIContractImportDialog({ open, onOpenChange, onResult }: Props) {
  const { checkAutoComplete } = useOnboardingProgress();
  const [step, setStep] = useState<Step>("upload");
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [addendaFiles, setAddendaFiles] = useState<File[]>([]);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const mainInputRef = useRef<HTMLInputElement>(null);
  const addendaInputRef = useRef<HTMLInputElement>(null);
  const [mainDragOver, setMainDragOver] = useState(false);
  const [addendaDragOver, setAddendaDragOver] = useState(false);

  const reset = () => {
    setStep("upload");
    setMainFile(null);
    setAddendaFiles([]);
    setProgressMsg("");
    setErrorMsg("");
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const removeAddendum = (index: number) => {
    setAddendaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (!mainFile) return;

    setStep("processing");

    try {
      setProgressMsg("Extraindo texto do contrato principal...");
      const contractText = await extractTextFromPdf(mainFile);

      if (!contractText || contractText.length < 50) {
        throw new Error("Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.");
      }

      const addendaTexts: string[] = [];
      for (let i = 0; i < addendaFiles.length; i++) {
        setProgressMsg(`Extraindo texto do ${i + 1}º aditivo...`);
        const text = await extractTextFromPdf(addendaFiles[i]);
        addendaTexts.push(text);
      }

      setProgressMsg("Processando com IA...");

      const { data, error } = await supabase.functions.invoke("parse-contract-ai", {
        body: { contract_text: contractText, addenda_texts: addendaTexts },
      });

      if (error) {
        console.error("Supabase invoke error:", error);
        throw new Error(error.message || "Erro de comunicação com o servidor. Verifique sua conexão.");
      }

      if (data?.error) {
        console.error("Edge Function returned error:", data.error, "status:", data.status);
        // The v6 Edge Function returns specific error messages — use them directly
        throw new Error(data.error);
      }

      const propertiesArr: Array<Partial<PropertyFormValues>> = data.propertiesData && data.propertiesData.length > 0
        ? data.propertiesData
        : data.propertyData && Object.keys(data.propertyData).length > 0
          ? [data.propertyData]
          : [];

      const result: AIPrefillData = {
        contractData: data.contractData || {},
        parties: data.parties || [],
        clausesSummary: data.clausesSummary || "",
        mainFile,
        addendaFiles,
        propertyData: propertiesArr[0] || {},
        propertiesData: propertiesArr,
        peopleData: data.peopleData || [],
        inspectionData: data.inspectionData || null,
        obligationsData: (data.obligationsData || []).map((o: any) => ({ ...o, selected: true })),
      };

      toast.success("Contrato processado com sucesso! Revise os dados pré-preenchidos.");
      // Wire onboarding: mark contract import as complete
      checkAutoComplete("contract_imported");

      // Fire notification
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          createNotification({
            userId: user.id,
            title: "Contrato importado via IA",
            message: "Contrato foi processado e dados foram extraídos automaticamente",
            category: "contrato",
            referenceType: "contract",
            referenceId: undefined,
          });
        }
      });

      handleClose(false);
      onResult(result);
    } catch (err: any) {
      console.error("AI import error:", err);
      const msg = err.message || "Erro inesperado ao processar contrato.";
      setErrorMsg(msg);
      setStep("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Contrato com IA
          </DialogTitle>
          <DialogDescription>
            Envie o contrato principal e os aditivos em PDF. A IA irá extrair os dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                A IA funciona melhor com PDFs gerados digitalmente. Contratos escaneados (imagem) podem ter resultados limitados.
              </p>
            </div>

            {/* Main contract */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Contrato Principal *</label>
              <input
                ref={mainInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setMainFile(e.target.files?.[0] ?? null)}
              />
              {mainFile ? (
                <div className="flex items-start gap-2 rounded-md border px-3 py-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm break-all min-w-0 flex-1">{mainFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setMainFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${mainDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                  onClick={() => mainInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setMainDragOver(true); }}
                  onDragLeave={() => setMainDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setMainDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.name.toLowerCase().endsWith(".pdf")) setMainFile(file);
                  }}
                >
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">Arraste o PDF aqui ou clique para selecionar</p>
                </div>
              )}
            </div>

            {/* Addenda */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Aditivos (opcional)</label>
              <input
                ref={addendaInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setAddendaFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                  e.target.value = "";
                }}
              />
              {addendaFiles.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {addendaFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground font-medium w-6">{i + 1}º</span>
                      <span className="text-sm break-all flex-1">{f.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAddendum(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${addendaDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                onClick={() => addendaInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setAddendaDragOver(true); }}
                onDragLeave={() => setAddendaDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setAddendaDragOver(false);
                  const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".pdf"));
                  if (files.length > 0) setAddendaFiles((prev) => [...prev, ...files]);
                }}
              >
                <Upload className="mx-auto h-4 w-4 text-muted-foreground mb-0.5" />
                <p className="text-xs text-muted-foreground">Arraste PDFs aqui ou clique para adicionar aditivos</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button disabled={!mainFile} onClick={handleProcess}>
                <Sparkles className="mr-2 h-4 w-4" />
                Processar com IA
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">{progressMsg}</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Erro ao processar</p>
                <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
              <Button onClick={() => setStep("upload")}>Tentar novamente</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
