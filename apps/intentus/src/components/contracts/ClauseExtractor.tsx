import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileSearch,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Info,
  Users,
  Calendar,
  Copy,
  FileText,
  Upload,
  Shield,
} from "lucide-react";
import {
  useExtractClauses,
  type ExtractClausesInput,
  type ExtractClausesOutput,
  type ExtractedClause,
} from "@/hooks/useContractAI";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────

const RISK_BADGE: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  low: { label: "Baixo", color: "bg-green-100 text-green-700", icon: CheckCircle },
  medium: { label: "Médio", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  high: { label: "Alto", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

const CATEGORY_COLORS: Record<string, string> = {
  obrigacao: "bg-blue-100 text-blue-700",
  financeiro: "bg-emerald-100 text-emerald-700",
  garantia: "bg-purple-100 text-purple-700",
  rescisao: "bg-red-100 text-red-700",
  prazo: "bg-orange-100 text-orange-700",
  penalidade: "bg-rose-100 text-rose-700",
  geral: "bg-gray-100 text-gray-700",
};

// ── Sub Components ────────────────────────────────────────

function ClauseCard({ clause }: { clause: ExtractedClause }) {
  const risk = RISK_BADGE[clause.risk_level] || RISK_BADGE.low;
  const RiskIcon = risk.icon;
  const categoryColor = CATEGORY_COLORS[clause.category] || CATEGORY_COLORS.geral;

  function handleCopy() {
    navigator.clipboard.writeText(clause.content);
    toast.success("Cláusula copiada!");
  }

  return (
    <AccordionItem value={clause.number} className="border rounded-lg px-4 mb-2">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-2 text-left flex-1">
          <span className="text-xs font-mono text-muted-foreground w-8">
            {clause.number}
          </span>
          <span className="text-sm font-medium flex-1">{clause.title}</span>
          <Badge className={`text-[10px] ${categoryColor}`} variant="secondary">
            {clause.category}
          </Badge>
          <Badge className={`text-[10px] ${risk.color}`} variant="secondary">
            <RiskIcon className="h-3 w-3 mr-1" />
            {risk.label}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pb-2">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {clause.content}
          </p>
          {clause.notes && (
            <div className="flex items-start gap-2 p-2 rounded bg-blue-50 text-blue-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">{clause.notes}</p>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1 text-xs">
            <Copy className="h-3 w-3" />
            Copiar
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ── Main Component ────────────────────────────────────────

interface ClauseExtractorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  initialText?: string;
}

export default function ClauseExtractor({
  open,
  onOpenChange,
  contractId,
  initialText,
}: ClauseExtractorProps) {
  const [text, setText] = useState(initialText || "");
  const [documentUrl, setDocumentUrl] = useState("");
  const [result, setResult] = useState<ExtractClausesOutput | null>(null);
  const [inputMode, setInputMode] = useState<"text" | "url">("text");

  const extractMutation = useExtractClauses();

  async function handleExtract() {
    const input: ExtractClausesInput = {
      contractId: contractId || undefined,
      text: inputMode === "text" && text ? text : undefined,
      documentUrl: inputMode === "url" && documentUrl ? documentUrl : undefined,
    };

    if (!input.text && !input.documentUrl && !input.contractId) {
      toast.error("Insira o texto do contrato ou uma URL de documento.");
      return;
    }

    try {
      const data = await extractMutation.mutateAsync(input);
      setResult(data);

      // Fire notification
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          createNotification({
            userId: user.id,
            title: "Cláusulas extraídas",
            message: "Cláusulas foram extraídas e analisadas com sucesso",
            category: "contrato",
            referenceType: "contract",
            referenceId: contractId,
          });
        }
      });
    } catch {
      // error handled by mutation
    }
  }

  function handleReset() {
    setResult(null);
    setText("");
    setDocumentUrl("");
  }

  // ── Risk Summary ──

  function renderRiskSummary() {
    if (!result) return null;
    const high = result.clauses.filter((c) => c.risk_level === "high").length;
    const medium = result.clauses.filter((c) => c.risk_level === "medium").length;
    const low = result.clauses.filter((c) => c.risk_level === "low").length;

    return (
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{high}</p>
            <p className="text-xs text-red-600">Risco Alto</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{medium}</p>
            <p className="text-xs text-yellow-600">Risco Médio</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{low}</p>
            <p className="text-xs text-green-600">Risco Baixo</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Result View ──

  function renderResult() {
    if (!result) return null;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          </CardContent>
        </Card>

        {/* Risk Summary */}
        {renderRiskSummary()}

        {/* Parties */}
        {result.parties.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <Users className="h-4 w-4" />
                Partes Identificadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {result.parties.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">
                    {p.role}
                  </Badge>
                  <span>{p.name}</span>
                  {p.document && (
                    <span className="text-xs text-muted-foreground">({p.document})</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Key Dates */}
        {result.key_dates.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Datas Importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {result.key_dates.map((d, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">{d.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Clauses */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {result.clauses.length} Cláusulas Extraídas
          </h3>
          <Accordion type="multiple">
            {result.clauses.map((clause) => (
              <ClauseCard key={clause.number} clause={clause} />
            ))}
          </Accordion>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Modelo: {result.model_used}</span>
          <span>Tokens: {result.tokens_used?.toLocaleString("pt-BR")}</span>
        </div>

        <Button variant="outline" onClick={handleReset} className="w-full">
          Nova Extração
        </Button>
      </div>
    );
  }

  // ── Input View ──

  function renderInput() {
    return (
      <div className="space-y-4">
        {/* Input Mode Tabs */}
        <div className="flex gap-2">
          <Button
            variant={inputMode === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputMode("text")}
            className={inputMode === "text" ? "bg-[#e2a93b] hover:bg-[#c99430]" : ""}
          >
            <FileText className="h-3 w-3 mr-1" />
            Colar Texto
          </Button>
          <Button
            variant={inputMode === "url" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputMode("url")}
            className={inputMode === "url" ? "bg-[#e2a93b] hover:bg-[#c99430]" : ""}
          >
            <Upload className="h-3 w-3 mr-1" />
            URL do Documento
          </Button>
        </div>

        {inputMode === "text" ? (
          <div>
            <Label className="text-sm">Texto do Contrato</Label>
            <Textarea
              className="mt-1 text-sm font-mono"
              rows={12}
              placeholder="Cole aqui o texto completo do contrato para análise..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {text.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>
        ) : (
          <div>
            <Label className="text-sm">URL do Documento</Label>
            <Input
              className="mt-1"
              placeholder="https://storage.supabase.co/..."
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Suporta URLs públicas de documentos PDF ou DOCX.
            </p>
          </div>
        )}

        {contractId && (
          <div className="flex items-center gap-2 p-2 rounded bg-blue-50 text-blue-700 text-xs">
            <Info className="h-4 w-4 shrink-0" />
            Contrato vinculado: as cláusulas serão salvas automaticamente.
          </div>
        )}

        <Button
          onClick={handleExtract}
          disabled={extractMutation.isPending}
          className="w-full gap-2 bg-[#e2a93b] hover:bg-[#c99430]"
        >
          {extractMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extraindo cláusulas...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extrair Cláusulas com IA
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-[#e2a93b]" />
            Extrator de Cláusulas
          </DialogTitle>
        </DialogHeader>

        {result ? renderResult() : renderInput()}
      </DialogContent>
    </Dialog>
  );
}
