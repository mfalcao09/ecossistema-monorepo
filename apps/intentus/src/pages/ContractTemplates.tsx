import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileText, Eye, Info, FilePlus2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

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

export default function ContractTemplates() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewingTemplate, setViewingTemplate] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["clm-contract-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_contract_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = templates.filter((t: any) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || t.template_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleEmitContract = () => {
    toast.info("A emissão automática de contratos a partir de minutas será implementada em breve.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minutário</h1>
        <p className="text-muted-foreground">Minutas-padrão para emissão de contratos</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          As minutas são gerenciadas pelo departamento Jurídico. Para alterações, entre em contato com o setor responsável.
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar minuta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {TEMPLATE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} minutas</Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma minuta encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {t.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TEMPLATE_TYPES.find((tt) => tt.value === t.template_type)?.label || t.template_type}
                      </Badge>
                    </TableCell>
                    <TableCell>v{t.version}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setViewingTemplate(t)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Visualizar
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleEmitContract}>
                          <FilePlus2 className="h-4 w-4 mr-1" />
                          Emitir Contrato
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                {TEMPLATE_TYPES.find((tt) => tt.value === viewingTemplate?.template_type)?.label || viewingTemplate?.template_type}
              </Badge>
              <Badge variant="secondary">v{viewingTemplate?.version}</Badge>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                {viewingTemplate?.content || "Sem conteúdo disponível."}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
