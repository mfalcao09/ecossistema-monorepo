import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Bot, Plus, Pencil, Trash2, Eye } from "lucide-react";

const GEMINI_MODELS = [
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  { value: "gpt-5-nano", label: "GPT-5 Nano" },
];

interface Persona {
  id: string;
  function_key: string;
  tenant_id: string | null;
  display_name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type PersonaForm = Omit<Persona, "id" | "created_at" | "updated_at">;

const emptyForm: PersonaForm = {
  function_key: "",
  tenant_id: null,
  display_name: "",
  system_prompt: "",
  model: "gemini-2.5-flash",
  temperature: 0.3,
  max_tokens: null,
  is_active: true,
};

export default function SuperAdminAIPersonas() {
  const { isImpersonating, impersonatedTenantId } = useSuperAdminView();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonaForm>(emptyForm);

  // Fetch all personas
  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["ai-personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_personas")
        .select("*")
        .order("function_key");
      if (error) throw error;
      return data as Persona[];
    },
  });

  const globalPersonas = personas.filter((p) => !p.tenant_id);
  const tenantPersonas = personas.filter((p) => p.tenant_id === impersonatedTenantId);

  const upsertMutation = useMutation({
    mutationFn: async (data: PersonaForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase.from("ai_personas").update({
          display_name: data.display_name,
          system_prompt: data.system_prompt,
          model: data.model,
          temperature: data.temperature,
          max_tokens: data.max_tokens,
          is_active: data.is_active,
        } as any).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_personas").insert({
          function_key: data.function_key,
          tenant_id: data.tenant_id,
          display_name: data.display_name,
          system_prompt: data.system_prompt,
          model: data.model,
          temperature: data.temperature,
          max_tokens: data.max_tokens,
          is_active: data.is_active,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-personas"] });
      setEditOpen(false);
      toast.success(editingId ? "Persona atualizada" : "Persona criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_personas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-personas"] });
      toast.success("Persona removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = (tenantId: string | null) => {
    setEditingId(null);
    setForm({ ...emptyForm, tenant_id: tenantId });
    setEditOpen(true);
  };

  const openEdit = (p: Persona) => {
    setEditingId(p.id);
    setForm({
      function_key: p.function_key,
      tenant_id: p.tenant_id,
      display_name: p.display_name,
      system_prompt: p.system_prompt,
      model: p.model,
      temperature: p.temperature,
      max_tokens: p.max_tokens,
      is_active: p.is_active,
    });
    setEditOpen(true);
  };

  const openPreview = (functionKey: string) => {
    const global = globalPersonas.find((p) => p.function_key === functionKey);
    const tenant = tenantPersonas.find((p) => p.function_key === functionKey);
    let finalPrompt = global?.system_prompt || "(sem persona global)";
    if (tenant) {
      finalPrompt += `\n\n---\nInstruções operacionais específicas desta empresa:\n${tenant.system_prompt}`;
    }
    setPreviewPrompt(finalPrompt);
    setPreviewOpen(true);
  };

  const handleSave = () => {
    if (!form.display_name || !form.system_prompt || (!editingId && !form.function_key)) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    upsertMutation.mutate({ ...form, id: editingId ?? undefined });
  };

  const PersonaCard = ({ p, showPreview }: { p: Persona; showPreview?: boolean }) => (
    <Card key={p.id} className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{p.display_name}</CardTitle>
          <Badge variant={p.is_active ? "default" : "secondary"}>
            {p.is_active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <CardDescription className="font-mono text-xs">{p.function_key}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Modelo: {p.model}</span>
          <span>Temp: {p.temperature}</span>
          {p.max_tokens && <span>Max: {p.max_tokens}</span>}
        </div>
        <p className="text-sm line-clamp-3">{p.system_prompt}</p>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
            <Pencil className="h-3 w-3 mr-1" /> Editar
          </Button>
          {showPreview && (
            <Button size="sm" variant="outline" onClick={() => openPreview(p.function_key)}>
              <Eye className="h-3 w-3 mr-1" /> Preview
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm(`Excluir persona "${p.display_name}"?`)) {
                deleteMutation.mutate(p.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">IA & Personas</h1>
          <p className="text-sm text-muted-foreground">
            Configure o comportamento da IA para cada módulo do sistema
          </p>
        </div>
      </div>

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Personas Padrão</TabsTrigger>
          {isImpersonating && (
            <TabsTrigger value="tenant">Refinamentos por Empresa</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openCreate(null)}>
              <Plus className="h-4 w-4 mr-2" /> Criar Persona
            </Button>
          </div>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : globalPersonas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma persona global configurada.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {globalPersonas.map((p) => (
                <PersonaCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </TabsContent>

        {isImpersonating && (
          <TabsContent value="tenant" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openCreate(impersonatedTenantId!)}>
                <Plus className="h-4 w-4 mr-2" /> Criar Refinamento
              </Button>
            </div>
            {tenantPersonas.length === 0 ? (
              <p className="text-muted-foreground">Nenhum refinamento para esta empresa. Os padrões globais serão usados.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tenantPersonas.map((p) => (
                  <PersonaCard key={p.id} p={p} showPreview />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Persona" : "Nova Persona"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingId && (
              <div>
                <Label>Function Key *</Label>
                <Input
                  value={form.function_key}
                  onChange={(e) => setForm({ ...form, function_key: e.target.value })}
                  placeholder="ex: legal_chatbot"
                />
              </div>
            )}
            <div>
              <Label>Nome de Exibição *</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div>
              <Label>System Prompt *</Label>
              <Textarea
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                rows={10}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Modelo</Label>
                <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GEMINI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={form.max_tokens ?? ""}
                  onChange={(e) => setForm({ ...form, max_tokens: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Padrão do modelo"
                />
              </div>
            </div>
            <div>
              <Label>Temperatura: {form.temperature}</Label>
              <Slider
                value={[form.temperature]}
                onValueChange={([v]) => setForm({ ...form, temperature: Math.round(v * 100) / 100 })}
                min={0} max={1} step={0.05}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview do Prompt Final</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-[60vh] overflow-y-auto">
            {previewPrompt}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
