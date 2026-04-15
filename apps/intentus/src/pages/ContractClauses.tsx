import { useState, useCallback } from "react";
import {
  useContractClauses,
  useCreateClause,
  useUpdateClause,
  useDeleteClause,
  useEvaluateClauseRisk,
  useDetectConflicts,
} from "@/hooks/useContractClauses";
import type { ClauseConflict } from "@/hooks/useContractClauses";
import { clauseCategoryLabels } from "@/lib/clmSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Edit, BookOpen, Copy, Search, Sparkles,
  Loader2, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2,
  RefreshCw, Scale,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";

// ---------------------------------------------------------------------------
// Risk level helpers
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-500/20 text-green-700 dark:text-green-400",
  medium: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  high: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  critical: "bg-red-500/20 text-red-700 dark:text-red-400",
};

const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

const RISK_ICONS: Record<string, typeof CheckCircle2> = {
  low: CheckCircle2,
  medium: AlertTriangle,
  high: ShieldAlert,
  critical: ShieldAlert,
};

function RiskBadge({ level, score }: { level?: string; score?: number }) {
  const riskLevel = level || "low";
  const Icon = RISK_ICONS[riskLevel] || CheckCircle2;
  return (
    <Badge className={`text-[10px] gap-1 ${RISK_COLORS[riskLevel] || ""}`}>
      <Icon className="h-3 w-3" />
      {RISK_LABELS[riskLevel] || riskLevel}
      {typeof score === "number" && <span className="ml-0.5 opacity-70">({score})</span>}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ContractClauses() {
  const [category, setCategory] = useState("todas");
  const [riskLevel, setRiskLevel] = useState("todos");
  const [search, setSearch] = useState("");
  const { data: clauses, isLoading } = useContractClauses({ category, search, riskLevel });
  const createClause = useCreateClause();
  const updateClause = useUpdateClause();
  const deleteClause = useDeleteClause();
  const evaluateRisk = useEvaluateClauseRisk();
  const detectConflicts = useDetectConflicts();
  const queryClient = useQueryClient();
  const { canManageClauses, canEvaluateClauses } = usePermissions();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", content: "", category: "geral",
    contract_types: [] as string[], is_mandatory: false,
  });

  // AI generation state
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ count: number; fromContracts: boolean } | null>(null);

  // Selection state (for batch operations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Conflict detection state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictResult, setConflictResult] = useState<{
    conflicts: ClauseConflict[];
    summary: string;
  } | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!clauses) return;
    if (selectedIds.size === clauses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clauses.map((c) => c.id)));
    }
  }, [clauses, selectedIds.size]);

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      title: c.title, content: c.content, category: c.category,
      contract_types: c.contract_types ?? [], is_mandatory: c.is_mandatory,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    if (editingId) {
      await updateClause.mutateAsync({ id: editingId, ...form });
    } else {
      await createClause.mutateAsync(form);
    }
    setForm({ title: "", content: "", category: "geral", contract_types: [], is_mandatory: false });
    setShowForm(false);
    setEditingId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Cláusula copiada!");
  };

  // AI Generation
  const handleAiGenerate = async () => {
    setAiGenerating(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("extract-clauses-ai", {
        body: { action: "extract" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiResult({ count: data.count, fromContracts: data.from_contracts });
      queryClient.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast.success(`${data.count} cláusulas geradas com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar cláusulas");
    } finally {
      setAiGenerating(false);
    }
  };

  // Batch risk evaluation
  const handleBatchEvaluate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("Selecione pelo menos 1 cláusula");
      return;
    }
    await evaluateRisk.mutateAsync(ids);
    setSelectedIds(new Set());
  };

  // Conflict detection
  const handleDetectConflicts = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) {
      toast.error("Selecione pelo menos 2 cláusulas para detectar conflitos");
      return;
    }
    try {
      const result = await detectConflicts.mutateAsync(ids);
      setConflictResult({ conflicts: result.conflicts, summary: result.summary });
      setShowConflictDialog(true);
    } catch {
      // error handled by mutation
    }
  };

  // Risk distribution stats
  const riskStats = clauses ? {
    low: clauses.filter((c) => (c as any).risk_level === "low" || !(c as any).risk_level).length,
    medium: clauses.filter((c) => (c as any).risk_level === "medium").length,
    high: clauses.filter((c) => (c as any).risk_level === "high").length,
    critical: clauses.filter((c) => (c as any).risk_level === "critical").length,
  } : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Biblioteca de Cláusulas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie cláusulas reutilizáveis com variáveis dinâmicas e avaliação de risco por IA
          </p>
        </div>
        <div className="flex gap-2">
          {canManageClauses && (
            <Button variant="outline" onClick={() => { setShowAiDialog(true); setAiResult(null); }}>
              <Sparkles className="h-4 w-4 mr-1" /> Gerar com IA
            </Button>
          )}
          {canManageClauses && (
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: "", content: "", category: "geral", contract_types: [], is_mandatory: false }); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Cláusula
            </Button>
          )}
        </div>
      </div>

      {/* Risk Distribution Summary */}
      {riskStats && clauses && clauses.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(["low", "medium", "high", "critical"] as const).map((level) => (
            <Card key={level} className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setRiskLevel(riskLevel === level ? "todos" : level)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${level === "low" ? "text-green-500" : level === "medium" ? "text-yellow-500" : level === "high" ? "text-orange-500" : "text-red-500"}`} />
                  <span className="text-sm font-medium">{RISK_LABELS[level]}</span>
                </div>
                <span className="text-lg font-bold">{riskStats[level]}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{selectedIds.size} cláusula(s) selecionada(s)</span>
            <div className="flex gap-2">
              {canEvaluateClauses && (
                <Button size="sm" variant="outline" onClick={handleBatchEvaluate}
                  disabled={evaluateRisk.isPending}>
                  {evaluateRisk.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Reavaliar Risco
                </Button>
              )}
              {canEvaluateClauses && selectedIds.size >= 2 && (
                <Button size="sm" variant="outline" onClick={handleDetectConflicts}
                  disabled={detectConflicts.isPending}>
                  {detectConflicts.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Scale className="h-4 w-4 mr-1" />}
                  Detectar Conflitos
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Limpar Seleção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Generation Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Gerar Cláusulas com IA
            </DialogTitle>
            <DialogDescription>
              {!aiGenerating && !aiResult && (
                "A IA vai analisar todos os contratos da sua base e extrair cláusulas estruturadas com variáveis dinâmicas e avaliação de risco. Se não houver contratos, serão geradas cláusulas-modelo padrão."
              )}
              {aiGenerating && "Analisando contratos e gerando cláusulas com avaliação de risco... Isso pode levar alguns segundos."}
              {aiResult && (
                aiResult.fromContracts
                  ? `${aiResult.count} cláusulas foram extraídas dos seus contratos existentes com avaliação de risco.`
                  : `${aiResult.count} cláusulas-modelo padrão foram geradas com avaliação de risco.`
              )}
            </DialogDescription>
          </DialogHeader>

          {aiGenerating && (
            <div className="space-y-3 py-4">
              <Progress value={undefined} className="animate-pulse" />
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando com IA...
              </div>
            </div>
          )}

          {aiResult && (
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{aiResult.count}</p>
              <p className="text-sm text-muted-foreground">cláusulas geradas com avaliação de risco</p>
            </div>
          )}

          <DialogFooter>
            {!aiGenerating && !aiResult && (
              <>
                <Button variant="ghost" onClick={() => setShowAiDialog(false)}>Cancelar</Button>
                <Button onClick={handleAiGenerate}>
                  <Sparkles className="h-4 w-4 mr-1" /> Iniciar Geração
                </Button>
              </>
            )}
            {aiResult && (
              <Button onClick={() => setShowAiDialog(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Detection Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Análise de Conflitos
            </DialogTitle>
            <DialogDescription>{conflictResult?.summary}</DialogDescription>
          </DialogHeader>

          {conflictResult && conflictResult.conflicts.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {conflictResult.conflicts.map((conflict, i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={RISK_COLORS[conflict.severity] || ""}>
                        {conflict.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {conflict.conflict_type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm">{conflict.description}</p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Resolução:</strong> {conflict.resolution}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : conflictResult ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum conflito detectado entre as cláusulas selecionadas.</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setShowConflictDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cláusulas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {Object.entries(clauseCategoryLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={riskLevel} onValueChange={setRiskLevel}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Riscos</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>
        {clauses && clauses.length > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {selectedIds.size === clauses.length ? "Desmarcar" : "Selecionar"} Todas
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? "Editar Cláusula" : "Nova Cláusula"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Título da cláusula *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(clauseCategoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder={"Texto da cláusula. Use variáveis: {{nome_locatario}}, {{valor_aluguel}}, {{endereco}}, etc."}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="min-h-[120px]"
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} />
                <span className="text-sm">Obrigatória</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={createClause.isPending || updateClause.isPending}>
                {editingId ? "Atualizar" : "Criar"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : clauses && clauses.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {clauses.map((c) => {
            const cl = c as any;
            return (
              <Card key={c.id} className={`${selectedIds.has(c.id) ? "border-primary ring-1 ring-primary/30" : ""}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleSelect(c.id)}
                      />
                      <h3 className="font-medium text-sm">{c.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{clauseCategoryLabels[c.category] ?? c.category}</Badge>
                      {c.is_mandatory && <Badge className="text-[10px] bg-red-500/20 text-red-700">Obrigatória</Badge>}
                      <RiskBadge level={cl.risk_level} score={cl.risk_score} />
                      <span className="text-[10px] text-muted-foreground">v{c.version}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(c.content)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {canManageClauses && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canManageClauses && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteClause.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{c.content}</p>

                  {/* Risk factors (if evaluated) */}
                  {cl.risk_factors && Array.isArray(cl.risk_factors) && cl.risk_factors.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cl.risk_factors.slice(0, 3).map((rf: any, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {rf.factor?.slice(0, 60)}{rf.factor?.length > 60 ? "…" : ""}
                        </span>
                      ))}
                      {cl.risk_factors.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{cl.risk_factors.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {cl.tags && Array.isArray(cl.tags) && cl.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cl.tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Evaluation date */}
                  {cl.risk_evaluated_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Avaliado em {new Date(cl.risk_evaluated_at).toLocaleDateString("pt-BR")}
                      {cl.risk_model_used && ` • ${cl.risk_model_used}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 space-y-3">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhuma cláusula encontrada.</p>
          <p className="text-sm text-muted-foreground">
            Use o botão <strong>"Gerar com IA"</strong> para criar cláusulas automaticamente a partir dos seus contratos com avaliação de risco.
          </p>
        </div>
      )}
    </div>
  );
}
