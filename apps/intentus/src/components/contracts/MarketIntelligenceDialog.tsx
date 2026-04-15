import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ExternalLink, Brain, BarChart3, List, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Comparable {
  titulo?: string;
  preco?: number;
  area_m2?: number;
  preco_m2?: number;
  quartos?: number;
  banheiros?: number;
  endereco?: string;
  link?: string;
  fonte?: string;
  tipo?: string;
  imagem?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evaluation: any;
  onAnalysisGenerated: () => void;
}

const sourceColors: Record<string, string> = {
  zap: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  olx: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  vivareal: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  default: "bg-muted text-muted-foreground",
};

function fmtBRL(v?: number | null) {
  if (!v) return "—";
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtM2(v?: number | null) {
  if (!v) return null;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/m²`;
}

function median(arr: number[]) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function MarketIntelligenceDialog({ open, onOpenChange, evaluation, onAnalysisGenerated }: Props) {
  const [generating, setGenerating] = useState(false);

  const comparaveis: Comparable[] = Array.isArray(evaluation?.market_results) ? evaluation.market_results : [];
  const analysis: string = evaluation?.ai_market_analysis || "";

  const handleGenerateAnalysis = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/market-analysis-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          evaluation_id: evaluation.id,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }
      toast.success("Análise gerada com sucesso!");
      onAnalysisGenerated();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar análise");
    } finally {
      setGenerating(false);
    }
  };

  // Stats
  const precos = comparaveis.map((c) => c.preco).filter(Boolean) as number[];
  const precosM2 = comparaveis.map((c) => c.preco_m2).filter(Boolean) as number[];
  const minPreco = precos.length ? Math.min(...precos) : null;
  const maxPreco = precos.length ? Math.max(...precos) : null;
  const medPreco = median(precos);
  const minM2 = precosM2.length ? Math.min(...precosM2) : null;
  const maxM2 = precosM2.length ? Math.max(...precosM2) : null;
  const medM2 = median(precosM2);
  const vendaCount = comparaveis.filter((c) => c.tipo === "venda").length;
  const locacaoCount = comparaveis.filter((c) => c.tipo === "locacao").length;

  const propertyName = evaluation?.properties?.title || "Imóvel";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Inteligência de Mercado — {propertyName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="comparaveis">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comparaveis" className="gap-1.5">
              <List className="h-3.5 w-3.5" />
              Comparáveis
              {comparaveis.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{comparaveis.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analise" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              Análise IA
            </TabsTrigger>
            <TabsTrigger value="resumo" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Resumo
            </TabsTrigger>
          </TabsList>

          {/* ABA: Comparáveis */}
          <TabsContent value="comparaveis" className="mt-4">
            {comparaveis.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <List className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum comparável disponível. Os dados serão populados quando o n8n enviar os resultados do Apify no campo <code className="bg-muted px-1 rounded text-xs">market_results</code>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {comparaveis.map((c, i) => (
                  <Card key={i} className="overflow-hidden">
                    {c.imagem && (
                      <div className="h-32 overflow-hidden bg-muted">
                        <img
                          src={c.imagem}
                          alt={c.titulo || "Imóvel comparável"}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{c.titulo || "Imóvel"}</p>
                        <Badge
                          className={`text-[10px] shrink-0 ${sourceColors[c.fonte?.toLowerCase() || ""] ?? sourceColors.default}`}
                        >
                          {c.fonte || "N/A"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {c.preco && (
                          <span className="font-semibold text-foreground">{fmtBRL(c.preco)}</span>
                        )}
                        {c.area_m2 && (
                          <span className="text-muted-foreground">{c.area_m2} m²</span>
                        )}
                        {c.preco_m2 && (
                          <span className="text-primary font-medium">{fmtM2(c.preco_m2)}</span>
                        )}
                      </div>
                      {(c.quartos || c.endereco) && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {c.quartos && <div>{c.quartos} quarto{c.quartos !== 1 ? "s" : ""}{c.banheiros ? ` • ${c.banheiros} banheiro${c.banheiros !== 1 ? "s" : ""}` : ""}</div>}
                          {c.endereco && <div className="truncate">{c.endereco}</div>}
                        </div>
                      )}
                      {c.tipo && (
                        <Badge variant="outline" className="text-[10px] capitalize">{c.tipo}</Badge>
                      )}
                      {c.link && (
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Ver anúncio
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ABA: Análise IA */}
          <TabsContent value="analise" className="mt-4">
            {!analysis ? (
              <div className="py-10 text-center space-y-4">
                <Brain className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma análise gerada ainda. Clique abaixo para o Gemini analisar o posicionamento deste imóvel no mercado.
                </p>
                <Button onClick={handleGenerateAnalysis} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {generating ? "Gerando análise..." : "Gerar Análise com IA"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Análise gerada por Gemini</p>
                  <Button variant="outline" size="sm" onClick={handleGenerateAnalysis} disabled={generating} className="gap-1.5 h-7 text-xs">
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                    Regerar
                  </Button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 p-4">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ABA: Resumo */}
          <TabsContent value="resumo" className="mt-4">
            <div className="space-y-4">
              {comparaveis.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Sem dados estatísticos disponíveis.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total comparáveis" value={String(comparaveis.length)} />
                    {vendaCount > 0 && <StatCard label="Venda" value={String(vendaCount)} sub="anúncios" />}
                    {locacaoCount > 0 && <StatCard label="Locação" value={String(locacaoCount)} sub="anúncios" />}
                  </div>

                  {precos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preço Total</p>
                      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Mínimo" value={fmtBRL(minPreco)} icon={<TrendingDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />} />
                        <StatCard label="Mediana" value={fmtBRL(medPreco)} icon={<Minus className="h-3.5 w-3.5 text-primary" />} />
                        <StatCard label="Máximo" value={fmtBRL(maxPreco)} icon={<TrendingUp className="h-3.5 w-3.5 text-destructive" />} />
                      </div>
                    </div>
                  )}

                  {precosM2.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preço por m²</p>
                      <div className="grid grid-cols-3 gap-3">
                        <StatCard label="Mínimo" value={fmtM2(minM2) || "—"} icon={<TrendingDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />} />
                        <StatCard label="Mediana" value={fmtM2(medM2) || "—"} icon={<Minus className="h-3.5 w-3.5 text-primary" />} />
                        <StatCard label="Máximo" value={fmtM2(maxM2) || "—"} icon={<TrendingUp className="h-3.5 w-3.5 text-destructive" />} />
                      </div>
                    </div>
                  )}

                  {/* Mercado vs Imóvel atual */}
                  {(evaluation?.preco_m2_venda || evaluation?.preco_m2_locacao) && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Referência de Mercado (n8n)</p>
                      <div className="grid grid-cols-2 gap-3">
                        {evaluation.preco_m2_venda && (
                          <StatCard label="Mercado Venda" value={fmtM2(evaluation.preco_m2_venda) || "—"} sub="preço m² referência" />
                        )}
                        {evaluation.preco_m2_locacao && (
                          <StatCard label="Mercado Locação" value={fmtM2(evaluation.preco_m2_locacao) || "—"} sub="preço m² referência" />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-0.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
