import { useState } from "react";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Download, Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportToCSV } from "@/lib/csvExport";

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  login: "Login",
  export: "Exportação",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  login: "bg-purple-100 text-purple-800",
  export: "bg-amber-100 text-amber-800",
};

export default function ActivityLogTab() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useActivityLog({
    search: search || undefined,
    action: action || undefined,
    entityType: entityType || undefined,
    page,
    pageSize: 50,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  const handleExport = () => {
    if (!logs.length) return;
    exportToCSV(
      logs.map((l) => ({
        data: format(new Date(l.created_at), "dd/MM/yyyy HH:mm"),
        usuario: l.user_name,
        acao: ACTION_LABELS[l.action] || l.action,
        entidade: l.entity_type,
        nome: l.entity_name || "",
      })),
      "log-atividades",
      { data: "Data", usuario: "Usuário", acao: "Ação", entidade: "Entidade", nome: "Nome" }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={action} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Atualização</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="export">Exportação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="property">Imóvel</SelectItem>
              <SelectItem value="person">Pessoa</SelectItem>
              <SelectItem value="contract">Contrato</SelectItem>
              <SelectItem value="deal">Negócio</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-md border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{log.user_name}</span>
                    <Badge variant="secondary" className={ACTION_COLORS[log.action] || ""}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                    {log.entity_type && <Badge variant="outline" className="text-[10px]">{log.entity_type}</Badge>}
                  </div>
                  {log.entity_name && <p className="text-sm text-muted-foreground mt-0.5">{log.entity_name}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </span>
              </div>
            ))}
            {total > 50 && (
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-muted-foreground">{total} registros</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(page + 1) * 50 >= total} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
