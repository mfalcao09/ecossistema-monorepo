import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, FileText, ArrowLeft, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import TemplateRichEditor from "@/components/legal/TemplateRichEditor";

const TEMPLATE_TYPES = [
  { value: "locacao_residencial", label: "Locação Residencial" },
  { value: "locacao_comercial", label: "Locação Comercial" },
  { value: "venda", label: "Venda" },
  { value: "nda", label: "NDA" },
  { value: "termo_visita", label: "Termo de Visita" },
  { value: "proposta", label: "Proposta" },
  { value: "distrato", label: "Distrato" },
  { value: "administracao", label: "Administração" },
  { value: "outro", label: "Outro" },
];

export default function LegalTemplates() {
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", template_type: "outro", content: "", is_active: true });
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["legal-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("legal_contract_templates").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const payload = { ...form, tenant_id, created_by: user.id };
      if (editing) {
        const { error } = await supabase.from("legal_contract_templates").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_contract_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal-templates"] });
      qc.invalidateQueries({ queryKey: ["clm-contract-templates"] });
      toast.success("Modelo salvo!");
      setEditorOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal-templates"] });
      qc.invalidateQueries({ queryKey: ["clm-contract-templates"] });
      toast.success("Modelo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", template_type: "outro", content: "", is_active: true });
    setEditorOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, template_type: t.template_type, content: t.content || "", is_active: t.is_active });
    setEditorOpen(true);
  };

  const filtered = templates.filter((t: any) => t.name.toLowerCase().includes(search.toLowerCase()));

  // Full-screen editor mode
  if (editorOpen) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setEditorOpen(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Nome do modelo..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-64 h-9"
              />
              <Select value={form.template_type} onValueChange={(v) => setForm({ ...form, template_type: v })}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
                <Label className="text-sm">Ativo</Label>
              </div>
            </div>
          </div>
          <Button
            disabled={save.isPending || !form.name.trim()}
            onClick={() => save.mutate()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden flex">
          <TemplateRichEditor
            initialContent={form.content}
            onContentChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
          />
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modelos de Contrato</h1>
          <p className="text-muted-foreground">Biblioteca de minutas jurídicas com variáveis dinâmicas.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Modelo</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{templates.length} modelos</Badge>
      </div>

      {isLoading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum modelo encontrado.</TableCell></TableRow>
              ) : filtered.map((t: any) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{t.name}</div></TableCell>
                  <TableCell><Badge variant="outline">{TEMPLATE_TYPES.find(tt => tt.value === t.template_type)?.label || t.template_type}</Badge></TableCell>
                  <TableCell>v{t.version}</TableCell>
                  <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(t); }}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); remove.mutate(t.id); }}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
