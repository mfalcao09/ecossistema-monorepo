import { useState } from "react";
import { sanitizeContractHtml } from "@/lib/sanitizeHtml";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Download,
  Copy,
  Eye,
  Users,
  Calendar,
  DollarSign,
  Shield,
  FileEdit,
} from "lucide-react";
import {
  useDraftContract,
  CONTRACT_TYPE_OPTIONS,
  PARTY_ROLE_OPTIONS,
  GUARANTEE_TYPE_OPTIONS,
  ADJUSTMENT_INDEX_OPTIONS,
  type DraftContractInput,
  type DraftContractOutput,
} from "@/hooks/useContractAI";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────

interface PartyFormData {
  role: string;
  name: string;
  cpfCnpj: string;
  address: string;
}

interface WizardFormData {
  contractType: string;
  parties: PartyFormData[];
  propertyDescription: string;
  value: string;
  monthlyValue: string;
  startDate: string;
  endDate: string;
  paymentDueDay: string;
  adjustmentIndex: string;
  guaranteeType: string;
  specialClauses: string;
  additionalInstructions: string;
}

const EMPTY_PARTY: PartyFormData = {
  role: "",
  name: "",
  cpfCnpj: "",
  address: "",
};

const INITIAL_FORM: WizardFormData = {
  contractType: "",
  parties: [{ ...EMPTY_PARTY }, { ...EMPTY_PARTY }],
  propertyDescription: "",
  value: "",
  monthlyValue: "",
  startDate: "",
  endDate: "",
  paymentDueDay: "5",
  adjustmentIndex: "",
  guaranteeType: "",
  specialClauses: "",
  additionalInstructions: "",
};

const STEPS = [
  { id: 1, title: "Tipo", icon: FileText },
  { id: 2, title: "Partes", icon: Users },
  { id: 3, title: "Valores", icon: DollarSign },
  { id: 4, title: "Datas", icon: Calendar },
  { id: 5, title: "Garantias", icon: Shield },
  { id: 6, title: "Cláusulas", icon: FileEdit },
];

// ── Component ─────────────────────────────────────────────

interface ContractDraftWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftCreated?: (result: DraftContractOutput) => void;
}

export default function ContractDraftWizard({
  open,
  onOpenChange,
  onDraftCreated,
}: ContractDraftWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormData>({ ...INITIAL_FORM });
  const [result, setResult] = useState<DraftContractOutput | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const draftMutation = useDraftContract();

  // ── Form helpers ──

  function updateField<K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateParty(index: number, field: keyof PartyFormData, value: string) {
    setForm((prev) => {
      const parties = [...prev.parties];
      parties[index] = { ...parties[index], [field]: value };
      return { ...prev, parties };
    });
  }

  function addParty() {
    setForm((prev) => ({
      ...prev,
      parties: [...prev.parties, { ...EMPTY_PARTY }],
    }));
  }

  function removeParty(index: number) {
    if (form.parties.length <= 2) return;
    setForm((prev) => ({
      ...prev,
      parties: prev.parties.filter((_, i) => i !== index),
    }));
  }

  function resetWizard() {
    setStep(1);
    setForm({ ...INITIAL_FORM });
    setResult(null);
    setShowPreview(false);
  }

  // ── Validation ──

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!form.contractType;
      case 2:
        return form.parties.every((p) => p.role && p.name);
      case 3:
        return true; // optional
      case 4:
        return true; // optional
      case 5:
        return true; // optional
      case 6:
        return true; // optional
      default:
        return true;
    }
  }

  // ── Submit ──

  async function handleGenerate() {
    const input: DraftContractInput = {
      contractType: form.contractType,
      parties: form.parties
        .filter((p) => p.role && p.name)
        .map((p) => ({
          role: p.role,
          name: p.name,
          cpfCnpj: p.cpfCnpj || undefined,
          address: p.address || undefined,
        })),
      propertyDescription: form.propertyDescription || undefined,
      value: form.value ? Number(form.value) : undefined,
      monthlyValue: form.monthlyValue ? Number(form.monthlyValue) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      paymentDueDay: form.paymentDueDay ? Number(form.paymentDueDay) : undefined,
      adjustmentIndex: form.adjustmentIndex || undefined,
      guaranteeType: form.guaranteeType || undefined,
      specialClauses: form.specialClauses
        ? form.specialClauses.split("\n").filter(Boolean)
        : undefined,
      additionalInstructions: form.additionalInstructions || undefined,
    };

    try {
      const data = await draftMutation.mutateAsync(input);
      setResult(data);
      setShowPreview(true);
      onDraftCreated?.(data);

      // Fire notification
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          createNotification({
            userId: user.id,
            title: "Minuta gerada via wizard",
            message: "Contrato foi redigido com sucesso pela IA via wizard",
            category: "contrato",
            referenceType: "contract",
            referenceId: undefined,
          });
        }
      });
    } catch {
      // error handled by mutation
    }
  }

  function handleCopyHTML() {
    if (!result) return;
    navigator.clipboard.writeText(result.html);
    toast.success("HTML copiado para a área de transferência!");
  }

  function handleDownloadHTML() {
    if (!result) return;
    const blob = new Blob([result.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title || "minuta"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo HTML baixado!");
  }

  // ── Step Renderers ──

  function renderStep1() {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Tipo de Contrato *</Label>
          <Select
            value={form.contractType}
            onValueChange={(v) => updateField("contractType", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Escolha o tipo de contrato que deseja gerar. A IA vai criar uma minuta completa
          com cláusulas padrão para este tipo.
        </p>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Partes do Contrato *</Label>
          <Button variant="outline" size="sm" onClick={addParty} className="gap-1">
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </div>

        {form.parties.map((party, idx) => (
          <Card key={idx} className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  Parte {idx + 1}
                </Badge>
                {form.parties.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParty(idx)}
                    className="h-6 w-6 p-0 text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Qualificação *</Label>
                  <Select
                    value={party.role}
                    onValueChange={(v) => updateParty(idx, "role", v)}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Papel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="Nome completo ou razão social"
                    value={party.name}
                    onChange={(e) => updateParty(idx, "name", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">CPF/CNPJ</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="000.000.000-00"
                    value={party.cpfCnpj}
                    onChange={(e) => updateParty(idx, "cpfCnpj", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="Endereço completo"
                    value={party.address}
                    onChange={(e) => updateParty(idx, "address", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Descrição do Imóvel</Label>
          <Textarea
            className="mt-1 text-sm"
            rows={3}
            placeholder="Ex: Apartamento nº 101, Bloco A, Edifício Splendori, com 85m² de área útil..."
            value={form.propertyDescription}
            onChange={(e) => updateField("propertyDescription", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Valor Total (R$)</Label>
            <Input
              className="mt-1"
              type="number"
              placeholder="0,00"
              value={form.value}
              onChange={(e) => updateField("value", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm">Valor Mensal (R$)</Label>
            <Input
              className="mt-1"
              type="number"
              placeholder="0,00"
              value={form.monthlyValue}
              onChange={(e) => updateField("monthlyValue", e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Preencha os valores conforme o tipo de contrato. Para locação, o valor mensal
          é obrigatório. Para venda, informe o valor total.
        </p>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Data de Início</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.startDate}
              onChange={(e) => updateField("startDate", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm">Data de Término</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.endDate}
              onChange={(e) => updateField("endDate", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Dia do Vencimento</Label>
            <Select
              value={form.paymentDueDay}
              onValueChange={(v) => updateField("paymentDueDay", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 5, 10, 15, 20, 25, 30].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Dia {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Índice de Reajuste</Label>
            <Select
              value={form.adjustmentIndex}
              onValueChange={(v) => updateField("adjustmentIndex", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_INDEX_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  function renderStep5() {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Tipo de Garantia</Label>
          <Select
            value={form.guaranteeType}
            onValueChange={(v) => updateField("guaranteeType", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione a garantia..." />
            </SelectTrigger>
            <SelectContent>
              {GUARANTEE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          A garantia selecionada será incluída nas cláusulas do contrato gerado pela IA.
          Escolha "Nenhuma" se não houver garantia.
        </p>
      </div>
    );
  }

  function renderStep6() {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Cláusulas Especiais</Label>
          <Textarea
            className="mt-1 text-sm"
            rows={4}
            placeholder="Digite uma cláusula por linha. Ex:&#10;O imóvel será entregue pintado&#10;O locatário arcará com IPTU"
            value={form.specialClauses}
            onChange={(e) => updateField("specialClauses", e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Uma cláusula por linha. Serão adicionadas como cláusulas especiais na minuta.
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium">Instruções Adicionais para a IA</Label>
          <Textarea
            className="mt-1 text-sm"
            rows={3}
            placeholder="Ex: Use linguagem mais formal. Inclua cláusula de multa de 10% sobre o valor do aluguel..."
            value={form.additionalInstructions}
            onChange={(e) => updateField("additionalInstructions", e.target.value)}
          />
        </div>
      </div>
    );
  }

  // ── Preview ──

  function renderPreview() {
    if (!result) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{result.title}</h3>
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{result.clauses_count} cláusulas</Badge>
            <Badge variant="outline" className="text-xs">
              {result.model_used}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyHTML} className="gap-1">
            <Copy className="h-3 w-3" />
            Copiar HTML
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadHTML} className="gap-1">
            <Download className="h-3 w-3" />
            Baixar HTML
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(false)}
            className="gap-1"
          >
            <FileEdit className="h-3 w-3" />
            Editar Dados
          </Button>
        </div>

        <div
          className="border rounded-lg p-6 bg-white max-h-[400px] overflow-auto prose prose-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(result.html) }}
        />

        <p className="text-xs text-muted-foreground text-center">
          Tokens utilizados: {result.tokens_used?.toLocaleString("pt-BR")}
        </p>
      </div>
    );
  }

  // ── Stepper ──

  function renderStepper() {
    return (
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;

          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => isDone && setStep(s.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                  isActive
                    ? "bg-[#e2a93b] text-white font-medium"
                    : isDone
                    ? "bg-green-100 text-green-700 cursor-pointer hover:bg-green-200"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {s.title}
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Main Render ──

  const stepRenderers: Record<number, () => JSX.Element> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetWizard();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#e2a93b]" />
            Gerar Minuta com IA
          </DialogTitle>
        </DialogHeader>

        {showPreview && result ? (
          renderPreview()
        ) : (
          <>
            {renderStepper()}

            <div className="min-h-[250px]">{stepRenderers[step]?.()}</div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                disabled={step === 1}
                onClick={() => setStep((s) => s - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>

              {step < STEPS.length ? (
                <Button
                  disabled={!canAdvance()}
                  onClick={() => setStep((s) => s + 1)}
                  className="gap-1 bg-[#e2a93b] hover:bg-[#c99430]"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  disabled={!canAdvance() || draftMutation.isPending}
                  onClick={handleGenerate}
                  className="gap-1 bg-[#e2a93b] hover:bg-[#c99430]"
                >
                  {draftMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Gerar Minuta
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
