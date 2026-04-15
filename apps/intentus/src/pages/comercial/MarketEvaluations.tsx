import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, Loader2, CheckCircle2, AlertTriangle, Clock, ChevronDown, Building2, MapPin, Ruler, Info, Settings2, Copy, Save, Key, Database, Eye, EyeOff, XCircle, Trash2, Brain } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { MarketIntelligenceDialog } from "@/components/contracts/MarketIntelligenceDialog";

const DEFAULT_N8N_URL = "https://n8n.intentusrealestate.com.br/webhook-test/analise-mercado-local";
/** Dynamic Supabase config from env vars — never hardcode credentials */
const CURRENT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const CURRENT_SUPABASE_PROJECT_ID = CURRENT_SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");

export default function MarketEvaluations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: siteSettings, save: saveSiteSettings } = useSiteSettings();
  const [showDialog, setShowDialog] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [dbCreds, setDbCreds] = useState<{ host: string; database: string; user: string; password: string; port: number; connection_string: string } | null>(null);
  const [dbCredsLoading, setDbCredsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [webhookConfigOpen, setWebhookConfigOpen] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [intelligenceEval, setIntelligenceEval] = useState<any | null>(null);
  const [form, setForm] = useState({
    property_id: "",
    suggested_min_value: "",
    suggested_max_value: "",
    suggested_value: "",
    methodology_notes: "",
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["market-evaluations"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const query = supabase
        .from("market_evaluations")
        .select("*, properties(id, title, neighborhood, city, area_total, sale_price, rental_price, property_type)")
        .order("created_at", { ascending: false });
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties-for-eval"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const query = supabase
        .from("properties")
        .select("id, title, neighborhood, city, state, street, number, zip_code, area_total, rental_price, sale_price, property_type, purpose, rooms")
        .order("title");
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data } = await query;
      return data || [];
    },
  });

  const getSegmento = (propertyType: string | null): string => {
    if (!propertyType) return "residencial";
    if (propertyType === "comercial") return "comercial";
    if (propertyType === "industrial") return "industrial";
    return "residencial";
  };

  const getFinalidade = (purpose: string | null, rentalPrice: number | null, salePrice: number | null): string => {
    if (purpose === "locacao") return "locacao";
    if (purpose === "venda") return "venda";
    if (purpose === "ambos") return "ambos";
    // fallback from prices
    if (rentalPrice && salePrice) return "ambos";
    if (rentalPrice) return "locacao";
    return "venda";
  };

  const segmentoBadge = (segmento: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      residencial: { label: "Residencial", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
      comercial:   { label: "Comercial",   cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
      industrial:  { label: "Industrial",  cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    };
    const s = map[segmento] ?? map.residencial;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
  };

  const finalidadeBadge = (finalidade: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      venda:   { label: "Venda",   cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
      locacao: { label: "Locação", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
      ambos:   { label: "Ambos",   cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
    };
    const f = map[finalidade] ?? map.venda;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${f.cls}`}>{f.label}</span>;
  };

  // Sync webhook URL input with saved settings
  useEffect(() => {
    if (siteSettings) {
      const saved = siteSettings.settings?.n8n_webhook_market_analysis as string | undefined;
      if (saved) {
        setWebhookUrlInput(saved);
      } else {
        // Auto-populate default URL if not set
        saveSiteSettings({ settings: { ...siteSettings.settings, n8n_webhook_market_analysis: DEFAULT_N8N_URL } });
        setWebhookUrlInput(DEFAULT_N8N_URL);
      }
    }
  }, [siteSettings?.settings?.n8n_webhook_market_analysis]);

  const loadDbCreds = async () => {
    setDbCredsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const fnUrl = `https://${projectId}.supabase.co/functions/v1/get-db-credentials`;
      const resp = await fetch(fnUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      setDbCreds(data);
      setShowPassword(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar credenciais");
    } finally {
      setDbCredsLoading(false);
    }
  };


  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("market-evaluations-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "market_evaluations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["market-evaluations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createEval = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("market_evaluations").insert({
        tenant_id: tenantId,
        property_id: form.property_id,
        evaluated_by: user!.id,
        suggested_min_value: parseFloat(form.suggested_min_value) || null,
        suggested_max_value: parseFloat(form.suggested_max_value) || null,
        suggested_value: parseFloat(form.suggested_value) || null,
        methodology_notes: form.methodology_notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-evaluations"] });
      setShowDialog(false);
      setForm({ property_id: "", suggested_min_value: "", suggested_max_value: "", suggested_value: "", methodology_notes: "" });
      toast.success("Avaliação criada!");
    },
    onError: () => toast.error("Erro ao criar avaliação"),
  });

  const handleAnalyzeMarket = async (property: any) => {
    const webhookUrl = siteSettings?.settings?.n8n_webhook_market_analysis as string | undefined;
    if (!webhookUrl) {
      toast.error("Configure a URL do webhook n8n em Configurações do Sistema primeiro.");
      return;
    }

    setAnalyzingIds((prev) => new Set(prev).add(property.id));

    try {
      const tenantId = await getAuthTenantId();
      // Insert evaluation record
      const { data: evalRecord, error: insertError } = await supabase
        .from("market_evaluations")
        .insert({
          tenant_id: tenantId,
          property_id: property.id,
          evaluated_by: user!.id,
          created_by: user!.id,
          market_analysis_status: "processando",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["market-evaluations"] });

      // Fire webhook
      const segmento = getSegmento(property.property_type);
      const finalidade = getFinalidade(property.purpose, property.rental_price, property.sale_price);
      const sanitizeSlug = (value: string) =>
        (value || "").toLowerCase().trim().replace(/\s+/g, "-");
      const payload = {
        evaluation_id: evalRecord.id,
        imovel_id: property.id,
        endereco: {
          rua: property.street || "",
          numero: property.number || "",
          bairro: sanitizeSlug(property.neighborhood),
          cidade: sanitizeSlug(property.city),
          estado: property.state || "",
          cep: property.zip_code || "",
        },
        tipo: property.property_type || "imovel",
        segmento,
        finalidade,
        area_m2: property.area_total || null,
        quartos: property.rooms || null,
        preco_venda_atual: property.sale_price || null,
        preco_locacao_atual: property.rental_price || null,
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success("🔍 Análise iniciada! O resultado aparecerá automaticamente.");
    } catch (e: any) {
      toast.error("Erro ao iniciar análise: " + e.message);
    } finally {
      setAnalyzingIds((prev) => { const s = new Set(prev); s.delete(property.id); return s; });
    }
  };

  const handleCancelAnalysis = async (evalId: string, propertyId: string) => {
    try {
      const { error } = await supabase
        .from("market_evaluations")
        .update({ market_analysis_status: "pendente", market_analysis_at: null })
        .eq("id", evalId);
      if (error) throw error;
      setAnalyzingIds((prev) => { const s = new Set(prev); s.delete(propertyId); return s; });
      queryClient.invalidateQueries({ queryKey: ["market-evaluations"] });
      toast.success("Análise interrompida. Você pode reiniciar quando quiser.");
    } catch (e: any) {
      toast.error("Erro ao interromper análise: " + e.message);
    }
  };

  const deleteAllEvaluations = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase
        .from("market_evaluations")
        .delete()
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-evaluations"] });
      toast.success("Histórico de avaliações apagado.");
    },
    onError: () => toast.error("Erro ao apagar avaliações."),
  });

  const fmt = (v: number | null | undefined) => v ? `R$ ${v.toLocaleString("pt-BR")}` : "—";
  const fmtM2 = (v: number | null | undefined) => v ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²` : null;

  // Get last evaluation per property
  const lastEvalByProperty = evaluations.reduce((acc: Record<string, any>, e: any) => {
    if (!acc[e.property_id] || new Date(e.created_at) > new Date(acc[e.property_id].created_at)) {
      acc[e.property_id] = e;
    }
    return acc;
  }, {});

  const getComparisonBadge = (property: any, evaluation: any) => {
    if (!property.area_total) return null;
    const finalidade = getFinalidade(property.purpose, property.rental_price, property.sale_price);
    const marketM2 = finalidade === "locacao"
      ? (evaluation?.preco_m2_locacao ?? evaluation?.preco_m2_estimado)
      : (evaluation?.preco_m2_venda ?? evaluation?.preco_m2_estimado);
    if (!marketM2) return null;
    const currentPrice = finalidade === "locacao" ? property.rental_price : property.sale_price;
    if (!currentPrice) return null;
    const currentM2 = currentPrice / property.area_total;
    const diff = ((currentM2 - marketM2) / marketM2) * 100;
    if (diff > 5) return <Badge className="text-xs" variant="outline">⬆ Acima do mercado</Badge>;
    if (diff < -5) return <Badge className="text-xs" variant="secondary">⬇ Oportunidade</Badge>;
    return <Badge className="text-xs" variant="default">✓ Preço justo</Badge>;
  };

  const samplePayload = JSON.stringify({
    evaluation_id: "<uuid>",
    imovel_id: "<uuid>",
    endereco: { rua: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP", cep: "01310-100" },
    tipo: "apartamento",
    segmento: "residencial",
    finalidade: "ambos",
    area_m2: 80,
    quartos: 2,
    preco_venda_atual: 650000,
    preco_locacao_atual: 3500,
  }, null, 2);

  const handleSaveWebhookUrl = () => {
    if (!siteSettings) return;
    saveSiteSettings({ settings: { ...siteSettings.settings, n8n_webhook_market_analysis: webhookUrlInput } });
    setWebhookConfigOpen(false);
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrlInput);
    toast.success("URL copiada!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Avaliações de Mercado (CMA)</h1>
          <p className="text-muted-foreground">Análise comparativa de preços com inteligência de mercado via n8n</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Avaliação Manual
        </Button>
      </div>

      {/* Webhook Config Card */}
      <Card>
        <Collapsible open={webhookConfigOpen} onOpenChange={setWebhookConfigOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/40 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Configuração n8n — Análise de Mercado
                  <span className="text-xs font-normal text-muted-foreground truncate max-w-xs hidden sm:inline">
                    {webhookUrlInput || "Não configurado"}
                  </span>
                </CardTitle>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${webhookConfigOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              {/* Webhook URL row */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://n8n.exemplo.com/webhook/..."
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyWebhookUrl} title="Copiar URL">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleSaveWebhookUrl} disabled={!webhookUrlInput} size="sm" className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
              </div>

              {/* n8n Configuration Guide */}
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Guia de configuração do nó de retorno no n8n
                </p>
                <Tabs defaultValue="supabase-node">
                  <TabsList className="h-8 text-xs">
                    <TabsTrigger value="supabase-node" className="text-xs px-3">Nó Supabase</TabsTrigger>
                    <TabsTrigger value="postgres-node" className="text-xs px-3">Nó Postgres (SQL)</TabsTrigger>
                    <TabsTrigger value="credentials" className="text-xs px-3 gap-1"><Key className="h-3 w-3" />Credenciais</TabsTrigger>
                  </TabsList>

                  {/* Tab: Supabase Node */}
                  <TabsContent value="supabase-node" className="mt-3 space-y-2 text-xs">
                    <p className="text-muted-foreground">Configure o nó <strong>Supabase</strong> no n8n com as seguintes opções:</p>
                    <div className="bg-muted rounded-md p-3 font-mono space-y-1.5 text-[11px]">
                       <div><span className="text-muted-foreground">Operation:</span> <span className="text-foreground">Update</span></div>
                       <div><span className="text-muted-foreground">Table:</span> <span className="text-foreground">market_evaluations</span></div>
                       <div><span className="text-muted-foreground">Filters → Field:</span> <span className="text-foreground">id</span></div>
                       <div><span className="text-muted-foreground">Filters → Value:</span> <span className="text-foreground">{"{{ $('Webhook').item.json.body.evaluation_id }}"}</span></div>
                       <div className="border-t pt-1.5 mt-1.5"><span className="text-muted-foreground">Fields to update:</span></div>
                       <div className="pl-2 space-y-1">
                         <div><span className="text-muted-foreground">preco_m2_venda</span> → <span className="text-foreground">{"{{ $json.preco_m2_venda }}"}</span></div>
                         <div><span className="text-muted-foreground">preco_m2_locacao</span> → <span className="text-foreground">{"{{ $json.preco_m2_locacao }}"}</span></div>
                         <div><span className="text-muted-foreground">segmento_mercado</span> → <span className="text-foreground">{"{{ $json.segmento }}"}</span></div>
                         <div><span className="text-muted-foreground">market_analysis_status</span> → <span className="text-foreground">concluido</span></div>
                         <div><span className="text-muted-foreground">market_analysis_at</span> → <span className="text-foreground">{"{{ new Date().toISOString() }}"}</span></div>
                       </div>
                     </div>
                    <p className="text-muted-foreground text-[11px]">⚠️ O nó Supabase requer a <strong>Service Role Key</strong> — veja a aba Credenciais.</p>
                  </TabsContent>

                  {/* Tab: Postgres Node */}
                  <TabsContent value="postgres-node" className="mt-3 space-y-2 text-xs">
                    <p className="text-muted-foreground">Alternativa: use o nó <strong>Postgres</strong> com o SQL abaixo.</p>
                    <div className="relative">
                    <pre className="bg-muted rounded-md p-3 font-mono text-[11px] overflow-auto whitespace-pre-wrap">{`UPDATE market_evaluations
SET
  preco_m2_venda = {{ $json.preco_m2_venda }},
  preco_m2_locacao = {{ $json.preco_m2_locacao }},
  segmento_mercado = '{{ $json.segmento }}',
  market_analysis_status = 'concluido',
  market_analysis_at = NOW()
WHERE id = '{{ $('Webhook').item.json.body.evaluation_id }}'::uuid;`}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(`UPDATE market_evaluations\nSET\n  preco_m2_venda = {{ $json.preco_m2_venda }},\n  preco_m2_locacao = {{ $json.preco_m2_locacao }},\n  segmento_mercado = '{{ $json.segmento }}',\n  market_analysis_status = 'concluido',\n  market_analysis_at = NOW()\nWHERE id = '{{ $('Webhook').item.json.body.evaluation_id }}'::uuid;`);
                          toast.success("SQL copiado!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-[11px]">Use a <strong>Connection String</strong> disponível nas credenciais abaixo.</p>
                  </TabsContent>

                  {/* Tab: Credentials */}
                  <TabsContent value="credentials" className="mt-3 space-y-3 text-xs">
                    <div className="space-y-2">
                      {[
                        { label: "Supabase URL", value: CURRENT_SUPABASE_URL, note: "Use como URL base nas credenciais do nó Supabase" },
                        { label: "Project ID", value: CURRENT_SUPABASE_PROJECT_ID, note: "ID do projeto" },
                      ].map(({ label, value, note }) => (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[11px] text-foreground">{label}</span>
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2"
                              onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copiado!`); }}>
                              <Copy className="h-3 w-3" /> Copiar
                            </Button>
                          </div>
                          <div className="bg-muted rounded px-2 py-1 font-mono text-[10px] truncate text-muted-foreground">{value}</div>
                          <p className="text-[10px] text-muted-foreground">{note}</p>
                        </div>
                      ))}

                      {/* Postgres DB Credentials */}
                      <div className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                            <Database className="h-3.5 w-3.5 text-primary" />
                            Credenciais do Nó Postgres (n8n)
                          </div>
                          {!dbCreds && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 px-2"
                              onClick={loadDbCreds} disabled={dbCredsLoading}>
                              {dbCredsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
                              {dbCredsLoading ? "Carregando..." : "Carregar Credenciais"}
                            </Button>
                          )}
                        </div>
                        {!dbCreds ? (
                          <p className="text-[11px] text-muted-foreground">Clique em "Carregar Credenciais" para exibir os dados de conexão do banco necessários para configurar o nó Postgres no n8n.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {[
                              { label: "Host", value: dbCreds.host },
                              { label: "Database", value: dbCreds.database },
                              { label: "User", value: dbCreds.user },
                              { label: "Port", value: String(dbCreds.port) },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex items-center gap-2">
                                <span className="w-20 text-[11px] text-muted-foreground shrink-0">{label}</span>
                                <div className="flex-1 bg-muted rounded px-2 py-0.5 font-mono text-[10px] truncate">{value}</div>
                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                                  onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copiado!`); }}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            {/* Password row with show/hide */}
                            <div className="flex items-center gap-2">
                              <span className="w-20 text-[11px] text-muted-foreground shrink-0">Password</span>
                              <div className="flex-1 bg-muted rounded px-2 py-0.5 font-mono text-[10px] truncate">
                                {showPassword ? dbCreds.password : "•".repeat(Math.min(dbCreds.password.length, 20))}
                              </div>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setShowPassword(v => !v)}>
                                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                                onClick={() => { navigator.clipboard.writeText(dbCreds.password); toast.success("Senha copiada!"); }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            {/* Connection string */}
                            <div className="pt-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">Connection String</span>
                                <Button variant="ghost" size="sm" className="h-5 text-[11px] gap-1 px-1.5"
                                  onClick={() => { navigator.clipboard.writeText(dbCreds.connection_string); toast.success("Connection string copiada!"); }}>
                                  <Copy className="h-3 w-3" /> Copiar
                                </Button>
                              </div>
                              <div className="bg-muted rounded px-2 py-1 font-mono text-[10px] break-all text-muted-foreground">
                                {dbCreds.connection_string.replace(dbCreds.password, showPassword ? dbCreds.password : "••••••••")}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SECTION 1: Properties Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Imóveis — Analisar Inteligência de Mercado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Segmento / Finalidade</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Preço Atual</TableHead>
                <TableHead>Última Análise</TableHead>
                <TableHead>Resultado de Mercado</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p: any) => {
                const lastEval = lastEvalByProperty[p.id];
                const isAnalyzing = analyzingIds.has(p.id) || lastEval?.market_analysis_status === "processando";
                const isDone = lastEval?.market_analysis_status === "concluido";
                const isError = lastEval?.market_analysis_status === "erro";
                const segmento = getSegmento(p.property_type);
                const finalidade = getFinalidade(p.purpose, p.rental_price, p.sale_price);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{p.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">{p.property_type || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {segmentoBadge(segmento)}
                        {finalidadeBadge(finalidade)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {[p.neighborhood, p.city].filter(Boolean).join(", ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Ruler className="h-3 w-3 text-muted-foreground" />
                        {p.area_total ? `${p.area_total} m²` : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.sale_price && (
                        <div>
                          <div className="text-[10px] text-muted-foreground">Venda</div>
                          <div className="font-medium">{fmt(p.sale_price)}</div>
                          {p.area_total && <div className="text-xs text-muted-foreground">{fmtM2(p.sale_price / p.area_total)}</div>}
                        </div>
                      )}
                      {p.rental_price && (
                        <div className={p.sale_price ? "mt-1" : ""}>
                          <div className="text-[10px] text-muted-foreground">Locação/mês</div>
                          <div className="font-medium">{fmt(p.rental_price)}</div>
                          {p.area_total && <div className="text-xs text-muted-foreground">{fmtM2(p.rental_price / p.area_total)}</div>}
                        </div>
                      )}
                      {!p.sale_price && !p.rental_price && "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastEval ? format(new Date(lastEval.created_at), "dd/MM/yy") : "—"}
                    </TableCell>
                    <TableCell>
                      {isAnalyzing && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
                        </Badge>
                      )}
                      {isDone && (
                        <div className="space-y-1">
                          {lastEval?.preco_m2_venda && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground w-14">Venda:</span>
                              <Badge variant="outline" className="text-xs gap-1 font-mono">
                                <TrendingUp className="h-2.5 w-2.5" />{fmtM2(lastEval.preco_m2_venda)}
                              </Badge>
                            </div>
                          )}
                          {lastEval?.preco_m2_locacao && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground w-14">Locação:</span>
                              <Badge variant="secondary" className="text-xs gap-1 font-mono">
                                <TrendingUp className="h-2.5 w-2.5" />{fmtM2(lastEval.preco_m2_locacao)}
                              </Badge>
                            </div>
                          )}
                          {!lastEval?.preco_m2_venda && !lastEval?.preco_m2_locacao && lastEval?.preco_m2_estimado && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <TrendingUp className="h-3 w-3" />{fmtM2(lastEval.preco_m2_estimado)}
                            </Badge>
                          )}
                          {getComparisonBadge(p, lastEval)}
                        </div>
                      )}
                      {isError && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" /> Erro
                        </Badge>
                      )}
                      {!lastEval && !isAnalyzing && (
                        <span className="text-xs text-muted-foreground">Sem análise</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAnalyzing && lastEval && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleCancelAnalysis(lastEval.id, p.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Interromper
                          </Button>
                        )}
                        {isDone && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            onClick={() => setIntelligenceEval(lastEval)}
                          >
                            <Brain className="h-3.5 w-3.5" /> Inteligência
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isDone ? "outline" : "default"}
                          className="gap-1.5"
                          onClick={() => handleAnalyzeMarket(p)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando...</>
                          ) : (
                            <><TrendingUp className="h-3.5 w-3.5" /> {isDone ? "Re-analisar" : "Analisar Mercado"}</>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {properties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum imóvel cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECTION 2: History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Histórico de Avaliações
            </CardTitle>
            {evaluations.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="h-3.5 w-3.5" /> Apagar Histórico
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apagar todo o histórico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação removerá permanentemente todas as {evaluations.length} avaliação(ões) registradas. Não é possível desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteAllEvaluations.mutate()}
                    >
                      {deleteAllEvaluations.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Apagar Tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor Mín.</TableHead>
                <TableHead>Valor Máx.</TableHead>
                <TableHead>Valor Sugerido</TableHead>
                <TableHead>Mercado Venda (m²)</TableHead>
                <TableHead>Mercado Locação (m²)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{e.properties?.title || "—"}</div>
                    <div className="text-xs text-muted-foreground">{[e.properties?.neighborhood, e.properties?.city].filter(Boolean).join(", ")}</div>
                  </TableCell>
                  <TableCell>
                    {e.segmento_mercado ? segmentoBadge(e.segmento_mercado) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(e.evaluation_date || e.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-sm">{fmt(e.suggested_min_value)}</TableCell>
                  <TableCell className="text-sm">{fmt(e.suggested_max_value)}</TableCell>
                  <TableCell className="font-semibold text-sm">{fmt(e.suggested_value)}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {e.preco_m2_venda
                      ? <Badge variant="outline" className="text-xs font-mono">{fmtM2(e.preco_m2_venda)}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {e.preco_m2_locacao
                      ? <Badge variant="secondary" className="text-xs font-mono">{fmtM2(e.preco_m2_locacao)}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                   <TableCell>
                    {e.market_analysis_status === "processando" && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Analisando
                      </Badge>
                    )}
                    {e.market_analysis_status === "concluido" && (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Concluído
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs gap-1 px-2"
                          onClick={() => setIntelligenceEval(e)}
                        >
                          <Brain className="h-3 w-3" /> Ver
                        </Button>
                      </div>
                    )}
                    {e.market_analysis_status === "erro" && (
                      <Badge variant="destructive" className="text-xs">Erro</Badge>
                    )}
                    {(!e.market_analysis_status || e.market_analysis_status === "pendente") && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === "finalizado" ? "default" : "secondary"} className="capitalize text-xs">
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {evaluations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma avaliação encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual evaluation dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Avaliação Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Imóvel</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar imóvel" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title} — {p.neighborhood}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor Mín. (R$)</Label>
                <Input type="number" value={form.suggested_min_value} onChange={(e) => setForm((f) => ({ ...f, suggested_min_value: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Máx. (R$)</Label>
                <Input type="number" value={form.suggested_max_value} onChange={(e) => setForm((f) => ({ ...f, suggested_max_value: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Sugerido (R$)</Label>
                <Input type="number" value={form.suggested_value} onChange={(e) => setForm((f) => ({ ...f, suggested_value: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Metodologia / Notas</Label>
              <Textarea value={form.methodology_notes} onChange={(e) => setForm((f) => ({ ...f, methodology_notes: e.target.value }))} rows={3} placeholder="Descreva a metodologia..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => createEval.mutate()} disabled={!form.property_id || createEval.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* n8n info box */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground h-auto p-0">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Formato do payload enviado ao n8n (clique para expandir)
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${payloadOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Configure a URL do webhook em <strong>Configurações → Integração → Webhook n8n Análise de Mercado</strong>.
                O n8n deve fazer UPDATE em <code className="bg-muted px-1 rounded">market_evaluations</code> com os campos{" "}
                <code className="bg-muted px-1 rounded">preco_m2_estimado</code>,{" "}
                <code className="bg-muted px-1 rounded">market_analysis_status = 'concluido'</code> e{" "}
                <code className="bg-muted px-1 rounded">market_analysis_at = now()</code> usando o <code className="bg-muted px-1 rounded">evaluation_id</code>.
              </p>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-48 font-mono">{samplePayload}</pre>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      {/* Market Intelligence Dialog */}
      {intelligenceEval && (
        <MarketIntelligenceDialog
          open={!!intelligenceEval}
          onOpenChange={(v) => { if (!v) setIntelligenceEval(null); }}
          evaluation={intelligenceEval}
          onAnalysisGenerated={async () => {
            await queryClient.invalidateQueries({ queryKey: ["market-evaluations"] });
            // Refresh the eval data from DB so analysis shows immediately
            const { data } = await supabase
              .from("market_evaluations")
              .select("*, properties(id, title, neighborhood, city, area_total, sale_price, rental_price, property_type)")
              .eq("id", intelligenceEval.id)
              .single();
            if (data) setIntelligenceEval(data);
          }}
        />
      )}
    </div>
  );
}
