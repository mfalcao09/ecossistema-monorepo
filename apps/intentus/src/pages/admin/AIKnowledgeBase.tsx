import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "regra_negocio", label: "Regra de Negócio" },
  { value: "clausula_padrao", label: "Cláusula Padrão" },
  { value: "precedente", label: "Precedente" },
  { value: "faq", label: "FAQ" },
  { value: "correcao", label: "Correção" },
];

const FUNCTION_KEYS = [
  { value: "all", label: "Todas as funções" },
  { value: "legal_chatbot", label: "Chatbot Jurídico" },
  { value: "contract_parser", label: "Importação de Contratos" },
  { value: "clause_extractor", label: "Extração de Cláusulas" },
];

export default function AIKnowledgeBase() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("knowledge");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("regra_negocio");
  const [newFunctionKey, setNewFunctionKey] = useState("all");
  const [learningLoading, setLearningLoading] = useState(false);

  const { data: snippets = [], isLoading } = useQuery({
    queryKey: ["ai-knowledge-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_knowledge_base")
        .select("*")
        .order("relevance_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["ai-interaction-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_interaction_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const addSnippet = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim() || !newContent.trim()) throw new Error("Título e conteúdo são obrigatórios");
      const { error } = await supabase.from("ai_knowledge_base").insert({
        tenant_id: tenantId,
        title: newTitle,
        content: newContent,
        category: newCategory,
        function_key: newFunctionKey === "all" ? null : newFunctionKey,
        source_type: "manual",
        relevance_score: 0.8,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conhecimento adicionado!");
      setShowAdd(false);
      setNewTitle("");
      setNewContent("");
      qc.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSnippet = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ai_knowledge_base").update({ is_active: !is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-knowledge-base"] }),
  });

  const deleteSnippet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
    },
  });

  const runLearning = async () => {
    setLearningLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-learn", { body: { tenant_id: tenantId } });
      if (error) throw error;
      toast.success(`Aprendizado concluído! ${data?.snippets_created || 0} novos conhecimentos, ${data?.snippets_decayed || 0} decaídos.`);
      qc.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setLearningLoading(false);
    }
  };

  // Metrics
  const totalLogs = logs.length;
  const ratedLogs = logs.filter((l: any) => l.rating != null);
  const avgRating = ratedLogs.length > 0 ? (ratedLogs.reduce((a: number, l: any) => a + l.rating, 0) / ratedLogs.length).toFixed(1) : "N/A";
  const positiveRate = ratedLogs.length > 0 ? Math.round((ratedLogs.filter((l: any) => l.rating >= 4).length / ratedLogs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Brain className="h-6 w-6" />Base de Conhecimento IA</h1>
          <p className="text-muted-foreground">Gerencie o conhecimento que alimenta as respostas da IA para sua empresa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runLearning} disabled={learningLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${learningLoading ? "animate-spin" : ""}`} />
            {learningLoading ? "Processando..." : "Executar Aprendizado"}
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Adicionar Conhecimento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Conhecimento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Regra de comissão padrão" /></div>
                <div><Label>Conteúdo</Label><Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Descreva a regra, FAQ ou instrução..." rows={4} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Função IA</Label>
                    <Select value={newFunctionKey} onValueChange={setNewFunctionKey}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>{FUNCTION_KEYS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => addSnippet.mutate()} disabled={addSnippet.isPending} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="knowledge"><Brain className="h-4 w-4 mr-1" />Conhecimentos ({snippets.length})</TabsTrigger>
          <TabsTrigger value="metrics"><BarChart3 className="h-4 w-4 mr-1" />Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Relevância</TableHead>
                  <TableHead className="text-right">Usos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {snippets.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum conhecimento cadastrado. Adicione manualmente ou execute o aprendizado automático.</TableCell></TableRow>
                ) : snippets.map((s: any) => (
                  <TableRow key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={s.title}>{s.title}</TableCell>
                    <TableCell><Badge variant="outline">{CATEGORIES.find(c => c.value === s.category)?.label || s.category}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.source_type}</TableCell>
                    <TableCell className="text-right">{(s.relevance_score * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-right">{s.usage_count}</TableCell>
                    <TableCell>
                      <button onClick={() => toggleSnippet.mutate({ id: s.id, is_active: s.is_active })} title={s.is_active ? "Desativar" : "Ativar"}>
                        {s.is_active ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => deleteSnippet.mutate(s.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold">{totalLogs}</div>
                <p className="text-sm text-muted-foreground">Interações totais</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold">{ratedLogs.length}</div>
                <p className="text-sm text-muted-foreground">Com feedback</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold">{avgRating}</div>
                <p className="text-sm text-muted-foreground">Nota média</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">{positiveRate}%</div>
                <p className="text-sm text-muted-foreground">Aprovação</p>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-sm font-semibold">Últimas Interações</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 20).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell><Badge variant="outline">{FUNCTION_KEYS.find(f => f.value === l.function_key)?.label || l.function_key}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={l.input_summary}>{l.input_summary || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={l.output_summary}>{l.output_summary || "—"}</TableCell>
                    <TableCell>{l.rating != null ? `${l.rating}/5` : "—"}</TableCell>
                    <TableCell className="text-xs">{format(new Date(l.created_at), "dd/MM HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
