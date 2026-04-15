import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantModules } from "@/hooks/useTenantModules";
import { useUserPagePermissions, useUpdatePagePermissions } from "@/hooks/useUserPagePermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, Unlock, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SECTIONS = [
  {
    label: "Cadastros",
    pages: [
      { path: "/imoveis", title: "Imóveis", module: "imoveis" },
      { path: "/pessoas", title: "Pessoas", module: "pessoas" },
      { path: "/contratos", title: "Contratos", module: "contratos" },
      { path: "/garantias", title: "Garantias Contratuais", module: "garantias" },
    ],
  },
  {
    label: "Comercial",
    pages: [
      { path: "/comercial/dashboard", title: "Dashboard Comercial", module: "comercial" },
      { path: "/novos-negocios", title: "Iniciar Novo Negócio", module: "comercial" },
      { path: "/negocios", title: "Negócios em Andamento", module: "comercial" },
      { path: "/leads", title: "Pipeline", module: "comercial" },
      { path: "/comercial/agenda", title: "Agenda de Visitas", module: "comercial" },
      { path: "/comercial/disponibilidade", title: "Disponibilidade", module: "comercial" },
      { path: "/comercial/metas", title: "Metas & Ranking", module: "comercial" },
      { path: "/comercial/avaliacoes", title: "Avaliações de Mercado", module: "comercial" },
      { path: "/comercial/automacoes", title: "Automações Comerciais", module: "comercial" },
      { path: "/comercial/exclusividades", title: "Exclusividades", module: "comercial" },
      { path: "/comercial/relatorios", title: "Relatórios Comerciais", module: "comercial" },
    ],
  },
  {
    label: "Relacionamento",
    pages: [
      { path: "/relacionamento", title: "Gestão de Relacionamento", module: "relacionamento" },
      { path: "/rescisoes", title: "Rescisões", module: "relacionamento" },
      { path: "/reajustes", title: "Reajustes", module: "relacionamento" },
      { path: "/renovacoes", title: "Renovações", module: "relacionamento" },
      { path: "/liberacao-garantias", title: "Liberação de Garantias", module: "relacionamento" },
      { path: "/atendimento", title: "Central de Atendimento", module: "relacionamento" },
      { path: "/manutencao", title: "Manutenção & Vistorias", module: "manutencao" },
      { path: "/relacionamento/pesquisas", title: "Pesquisas de Satisfação", module: "relacionamento" },
      { path: "/relacionamento/regua", title: "Régua de Comunicação", module: "relacionamento" },
      { path: "/relacionamento/seguros", title: "Seguros & Sinistros", module: "relacionamento" },
      { path: "/relacionamento/automacoes", title: "Automações", module: "relacionamento" },
      { path: "/relacionamento/relatorios", title: "Relatórios", module: "relacionamento" },
    ],
  },
  {
    label: "Financeiro/Contábil",
    pages: [
      { path: "/financeiro/receitas", title: "Receitas", module: "financeiro_basico" },
      { path: "/financeiro/despesas", title: "Despesas", module: "financeiro_basico" },
      { path: "/financeiro/caixa", title: "Fluxo de Caixa", module: "financeiro_basico" },
      { path: "/financeiro/comissoes", title: "Comissões", module: "comissoes" },
      { path: "/financeiro/repasses", title: "Repasses", module: "repasses" },
      { path: "/financeiro/inadimplencia", title: "Inadimplência", module: "financeiro_completo" },
      { path: "/financeiro/conciliacao", title: "Conciliação Bancária", module: "conciliacao_bancaria" },
      { path: "/financeiro/contas", title: "Contas Bancárias", module: "contas_bancarias" },
      { path: "/financeiro/faturas-emitidas", title: "Faturas", module: "integracao_bancaria" },
      { path: "/financeiro/dre", title: "DRE Gerencial", module: "dre_gerencial" },
      { path: "/financeiro/ir", title: "Retenção IR", module: "retencao_ir" },
      { path: "/financeiro/dimob", title: "DIMOB", module: "dimob" },
    ],
  },
  {
    label: "Gestão de Contratos (CLM)",
    pages: [
      { path: "/contratos/minutario", title: "Minutário", module: "contratos" },
      { path: "/contratos/clausulas", title: "Biblioteca de Cláusulas", module: "contratos" },
      { path: "/contratos/analytics", title: "Analytics CLM", module: "contratos" },
    ],
  },
  {
    label: "Jurídico",
    pages: [
      { path: "/juridico", title: "Análises", module: "juridico" },
      { path: "/due-diligence", title: "Due Diligence", module: "due_diligence" },
      { path: "/juridico/modelos", title: "Modelos de Contrato", module: "juridico" },
      { path: "/juridico/procuracoes", title: "Procurações", module: "juridico" },
      { path: "/juridico/notificacoes", title: "Notificações Extrajudiciais", module: "juridico" },
      { path: "/juridico/processos", title: "Processos Judiciais", module: "juridico" },
      { path: "/juridico/compliance", title: "Compliance", module: "juridico" },
      { path: "/juridico/assinaturas", title: "Assinaturas Digitais", module: "juridico" },
    ],
  },
  {
    label: "Lançamentos Imobiliários",
    pages: [
      { path: "/lancamentos", title: "Empreendimentos", module: "empreendimentos" },
      { path: "/lancamentos/espelho", title: "Espelho de Vendas", module: "empreendimentos" },
      { path: "/lancamentos/pipeline", title: "Pipeline de Vendas", module: "empreendimentos" },
      { path: "/lancamentos/propostas", title: "Propostas", module: "empreendimentos" },
      { path: "/lancamentos/contratos", title: "Contratos", module: "empreendimentos" },
      { path: "/lancamentos/dashboard", title: "Dashboard Comercial", module: "empreendimentos" },
      { path: "/lancamentos/tarefas", title: "Tarefas", module: "empreendimentos" },
    ],
  },
];

export function PermissionsTab() {
  const { tenantId, user: currentUser } = useAuth();
  const { hasModule } = useTenantModules();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const updateMutation = useUpdatePagePermissions();

  const { data: users = [] } = useQuery({
    queryKey: ["tenant-users-for-permissions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, phone, active")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["tenant-user-roles-for-permissions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: permissions = [] } = useUserPagePermissions(selectedUserId ?? undefined);

  const manageableUsers = useMemo(() => {
    const adminUserIds = new Set(
      userRoles.filter((r) => ["admin", "gerente", "superadmin"].includes(r.role)).map((r) => r.user_id)
    );
    return users.filter((u) => u.user_id !== currentUser?.id && !adminUserIds.has(u.user_id));
  }, [users, userRoles, currentUser]);

  const permMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    permissions.forEach((p) => {
      map[p.page_path] = p.allowed;
    });
    return map;
  }, [permissions]);

  const isAllowed = (path: string) => permMap[path] !== false;

  const handleToggle = async (path: string, allowed: boolean) => {
    if (!selectedUserId) return;
    try {
      await updateMutation.mutateAsync({
        userId: selectedUserId,
        permissions: [{ page_path: path, allowed }],
      });
      toast.success(allowed ? "Acesso liberado" : "Acesso bloqueado");
    } catch {
      toast.error("Erro ao salvar permissão");
    }
  };

  const handleBulkAction = async (allowed: boolean) => {
    if (!selectedUserId) return;
    const allPages = PAGE_SECTIONS.flatMap((s) =>
      s.pages.filter((p) => hasModule(p.module)).map((p) => ({ page_path: p.path, allowed }))
    );
    try {
      await updateMutation.mutateAsync({ userId: selectedUserId, permissions: allPages });
      toast.success(allowed ? "Todas as telas liberadas" : "Todas as telas bloqueadas");
    } catch {
      toast.error("Erro ao salvar permissões");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Usuários</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-340px)]">
            {manageableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nenhum usuário disponível para gerenciar.</p>
            ) : (
              <div className="space-y-0.5 p-2">
                {manageableUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => setSelectedUserId(u.user_id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                      selectedUserId === u.user_id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <User className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.phone ?? ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {selectedUserId
              ? `Telas de ${manageableUsers.find((u) => u.user_id === selectedUserId)?.name ?? "..."}`
              : "Selecione um usuário"}
          </CardTitle>
          {selectedUserId && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkAction(true)} disabled={updateMutation.isPending}>
                <Unlock className="h-3.5 w-3.5 mr-1.5" />Liberar tudo
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction(false)} disabled={updateMutation.isPending}>
                <Lock className="h-3.5 w-3.5 mr-1.5" />Bloquear tudo
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!selectedUserId ? (
            <p className="text-sm text-muted-foreground">Selecione um usuário na lista ao lado para gerenciar suas permissões.</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-6">
                {PAGE_SECTIONS.map((section) => {
                  const availablePages = section.pages.filter((p) => hasModule(p.module));
                  const unavailablePages = section.pages.filter((p) => !hasModule(p.module));
                  if (availablePages.length === 0 && unavailablePages.length === 0) return null;

                  return (
                    <div key={section.label}>
                      <h3 className="text-sm font-semibold text-foreground mb-3">{section.label}</h3>
                      <div className="space-y-2">
                        {availablePages.map((page) => (
                          <div key={page.path} className="flex items-center justify-between px-3 py-2 rounded-md border">
                            <span className="text-sm">{page.title}</span>
                            <Switch
                              checked={isAllowed(page.path)}
                              onCheckedChange={(checked) => handleToggle(page.path, checked)}
                              disabled={updateMutation.isPending}
                            />
                          </div>
                        ))}
                        {unavailablePages.map((page) => (
                          <Tooltip key={page.path}>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between px-3 py-2 rounded-md border opacity-40 cursor-not-allowed">
                                <span className="text-sm">{page.title}</span>
                                <Badge variant="outline" className="text-[10px]">Indisponível</Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Não disponível no seu plano</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
