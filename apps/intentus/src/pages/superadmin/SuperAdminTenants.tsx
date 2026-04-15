import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Search, MoreHorizontal, Pencil, Plus, RefreshCw, User, Phone, Mail, Power, Trash2, ArrowUpDown, KeyRound } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, differenceInDays, addMonths, addDays } from "date-fns";
import { toast } from "sonner";
import { formatCpfCnpj, isValidCNPJ, isValidCPF } from "@/lib/cpfCnpjValidation";

interface Plan {
  id: string;
  name: string;
  max_users: number | null;
  price_monthly: number;
}

const emptyForm = {
  name: "",
  slug: "",
  cnpj: "",
  razaoSocial: "",
  telefone: "",
  email: "",
  tipo: "imobiliaria",
  receitaAnual: "",
  plan_id: "",
  duration_months: "1",
  repNome: "",
  repEmail: "",
  repDocumento: "",
  repNascimento: "",
  repRendaMensal: "",
  repOcupacao: "",
  repCelular: "",
  adminPassword: "",
};

export default function SuperAdminTenants() {
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ ...emptyForm });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<any>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changePlanTenant, setChangePlanTenant] = useState<any>(null);
  const [changePlanId, setChangePlanId] = useState("");
  const qc = useQueryClient();

  const { data: plans = [] } = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id, name, max_users, price_monthly").eq("active", true).order("price_monthly");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["superadmin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["superadmin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, plans(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateTenant = useMutation({
    mutationFn: async () => {
      if (!selectedTenant) return;
      if (editForm.cnpj.trim() && !isValidCNPJ(editForm.cnpj)) {
        throw new Error("CNPJ informado é inválido.");
      }
      if (editForm.repDocumento.trim() && !isValidCPF(editForm.repDocumento)) {
        throw new Error("CPF do representante é inválido.");
      }
      const settings = {
        razaoSocial: editForm.razaoSocial,
        telefone: editForm.telefone,
        email: editForm.email,
        tipo: editForm.tipo,
        receitaAnual: editForm.receitaAnual,
        representante: {
          nome: editForm.repNome,
          email: editForm.repEmail,
          documento: editForm.repDocumento,
          nascimento: editForm.repNascimento,
          rendaMensal: editForm.repRendaMensal,
          ocupacao: editForm.repOcupacao,
          celular: editForm.repCelular,
        },
      };
      const { error } = await supabase.from("tenants").update({
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        cnpj: editForm.cnpj.trim() || null,
        settings,
      } as any).eq("id", selectedTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      toast.success("Empresa atualizada!");
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTenant = useMutation({
    mutationFn: async () => {
      if (newForm.cnpj.trim() && !isValidCNPJ(newForm.cnpj)) {
        throw new Error("CNPJ informado é inválido.");
      }
      if (newForm.repDocumento.trim() && !isValidCPF(newForm.repDocumento)) {
        throw new Error("CPF do representante é inválido.");
      }
      const settings = {
        razaoSocial: newForm.razaoSocial,
        telefone: newForm.telefone,
        email: newForm.email,
        tipo: newForm.tipo,
        receitaAnual: newForm.receitaAnual,
        representante: {
          nome: newForm.repNome,
          email: newForm.repEmail,
          documento: newForm.repDocumento,
          nascimento: newForm.repNascimento,
          rendaMensal: newForm.repRendaMensal,
          ocupacao: newForm.repOcupacao,
          celular: newForm.repCelular,
        },
      };

      const slug = newForm.slug.trim() || newForm.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50) + "-" + Date.now().toString(36);

      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({
          name: newForm.name.trim(),
          slug,
          cnpj: newForm.cnpj.trim() || null,
          plan_id: newForm.plan_id,
          settings,
        } as any)
        .select()
        .single();
      if (tErr) throw tErr;

      const selectedPlanObj = plans.find((p) => p.id === newForm.plan_id);
      const isTrialPlan = selectedPlanObj?.price_monthly === 0;
      const months = parseInt(newForm.duration_months) || 1;
      const expiresAt = isTrialPlan
        ? addDays(new Date(), 7).toISOString()
        : addMonths(new Date(), months).toISOString();

      const { error: sErr } = await supabase.from("tenant_subscriptions").insert({
        tenant_id: tenant.id,
        plan_id: newForm.plan_id,
        status: "ativo",
        expires_at: expiresAt,
      } as any);
      if (sErr) throw sErr;

      // Create admin user if email provided
      if (newForm.repEmail.trim()) {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/provision-tenant`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "x-webhook-secret": "manual-provision",
            },
            body: JSON.stringify({
              company_name: newForm.name.trim(),
              slug,
              cnpj: newForm.cnpj.trim() || null,
              settings,
              admin_email: newForm.repEmail.trim(),
              admin_name: newForm.repNome.trim() || newForm.name.trim(),
              admin_password: newForm.adminPassword.trim() || undefined,
            }),
          }
        );
        if (!response.ok) {
          const err = await response.json();
          console.warn("Provision user warning:", err);
          toast.info("Empresa criada, mas houve um problema ao criar o usuário admin. Crie manualmente.");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      toast.success("Empresa criada com sucesso!");
      setNewOpen(false);
      setNewForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renewSubscription = useMutation({
    mutationFn: async (tenantId: string) => {
      const sub = subscriptions.find((s: any) => s.tenant_id === tenantId);
      if (!sub) throw new Error("Assinatura não encontrada");
      const baseDate = new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
      const newExpires = addMonths(baseDate, 1).toISOString();
      const { error } = await supabase
        .from("tenant_subscriptions")
        .update({
          expires_at: newExpires,
          renewed_at: new Date().toISOString(),
          renewal_count: (sub.renewal_count || 0) + 1,
          status: "ativo",
        } as any)
        .eq("id", sub.id);
      if (error) throw error;
      // Reactivate tenant when subscription is renewed
      await supabase.from("tenants").update({ active: true } as any).eq("id", tenantId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      toast.success("Assinatura renovada por +30 dias!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTenantActive = useMutation({
    mutationFn: async ({ tenantId, active }: { tenantId: string; active: boolean }) => {
      const { error } = await supabase.from("tenants").update({ active } as any).eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      toast.success(active ? "Empresa ativada!" : "Empresa inativada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTenant = useMutation({
    mutationFn: async (tenantId: string) => {
      // Delete subscription first
      await supabase.from("tenant_subscriptions").delete().eq("tenant_id", tenantId);
      // Delete profiles and user_roles
      const { data: profiles } = await supabase.from("profiles").select("user_id").eq("tenant_id", tenantId);
      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          await supabase.from("user_roles").delete().eq("user_id", p.user_id);
        }
        await supabase.from("profiles").delete().eq("tenant_id", tenantId);
      }
      // Delete tenant
      const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      toast.success("Empresa excluída com sucesso!");
      setDeleteConfirmOpen(false);
      setTenantToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendCredentials = useMutation({
    mutationFn: async ({ tenantId }: { tenantId: string }) => {
      // Find admin user for this tenant
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("tenant_id", tenantId);
      if (!profiles || profiles.length === 0) throw new Error("Nenhum usuário encontrado para esta empresa");

      // Get admin role user
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("role", "admin");

      const adminUserId = adminRoles?.[0]?.user_id || profiles[0].user_id;

      // Get user email from profiles (we need to call the edge function)
      const { data: session } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      // We need the user's email - get it from tenant settings
      const tenant = tenants.find((t: any) => t.id === tenantId);
      const settings = tenant?.settings as any;
      const adminEmail = settings?.representante?.email || settings?.email;
      if (!adminEmail) throw new Error("Email do admin não encontrado nos dados da empresa. Verifique o cadastro.");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/resend-credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({ user_id: adminUserId, email: adminEmail }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao reenviar credenciais");
      if (result.email_sent === false) {
        toast.warning("Senha atualizada, mas email não pôde ser enviado. Nova senha: " + result.temp_password);
        return;
      }
    },
    onSuccess: () => toast.success("Credenciais reenviadas com sucesso!"),
    onError: (e: Error) => toast.error(e.message),
  });

  const changePlan = useMutation({
    mutationFn: async ({ tenantId, planId }: { tenantId: string; planId: string }) => {
      const sub = subscriptions.find((s: any) => s.tenant_id === tenantId);
      if (!sub) throw new Error("Assinatura não encontrada");
      const { error } = await supabase
        .from("tenant_subscriptions")
        .update({ plan_id: planId, updated_at: new Date().toISOString() } as any)
        .eq("id", sub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      toast.success("Plano alterado com sucesso! A mudança será refletida na próxima fatura.");
      setChangePlanOpen(false);
      setChangePlanTenant(null);
      setChangePlanId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getSubForTenant = (tenantId: string) => subscriptions.find((s: any) => s.tenant_id === tenantId);

  const getStatusBadge = (sub: any) => {
    if (!sub) return <Badge variant="outline">Sem plano</Badge>;
    const now = new Date();
    const expires = new Date(sub.expires_at);
    const daysLeft = differenceInDays(expires, now);
    if (sub.status === "cancelado") return <Badge variant="destructive">Cancelado</Badge>;
    if (daysLeft < 0) return <Badge variant="destructive">Expirado</Badge>;
    if (daysLeft <= 15) return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Expira em {daysLeft}d</Badge>;
    return <Badge className="bg-green-600 hover:bg-green-700 text-white">Ativo</Badge>;
  };

  const getSettings = (tenant: any) => {
    try {
      return typeof tenant.settings === "object" ? tenant.settings : {};
    } catch {
      return {};
    }
  };

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.cnpj && t.cnpj.includes(search))
  );

  const openDetail = (tenant: any) => { setSelectedTenant(tenant); setDetailOpen(true); };
  const openEdit = (tenant: any) => {
    const s = getSettings(tenant);
    const rep = s?.representante || {};
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name || "",
      slug: tenant.slug || "",
      cnpj: tenant.cnpj || "",
      razaoSocial: s?.razaoSocial || "",
      telefone: s?.telefone || "",
      email: s?.email || "",
      tipo: s?.tipo || "imobiliaria",
      receitaAnual: s?.receitaAnual || "",
      plan_id: "",
      duration_months: "1",
      repNome: rep?.nome || "",
      repEmail: rep?.email || "",
      repDocumento: rep?.documento || "",
      repNascimento: rep?.nascimento || "",
      repRendaMensal: rep?.rendaMensal || "",
      repOcupacao: rep?.ocupacao || "",
      repCelular: rep?.celular || "",
      adminPassword: "",
    });
    setEditOpen(true);
  };

  const updateField = (field: string, value: string) => setNewForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">Gerencie todas as empresas cadastradas na plataforma.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Empresa</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{tenants.length} empresas</Badge>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada.</TableCell>
                </TableRow>
              ) : (
                filtered.map((tenant) => {
                  const isMaster = tenant.id === "00000000-0000-0000-0000-000000000001";
                  const sub = getSubForTenant(tenant.id);
                  const planName = sub?.plans?.name || "—";
                  const s = getSettings(tenant);
                  const repNome = s?.representante?.nome || "—";
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{tenant.name}</div>
                            <code className="text-[10px] text-muted-foreground">{tenant.slug}</code>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{tenant.cnpj || "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{s?.tipo || "—"}</TableCell>
                      <TableCell>{isMaster ? <Badge variant="outline">Permanente</Badge> : planName}</TableCell>
                      <TableCell>
                        {isMaster ? (
                          <Badge className="bg-green-600 hover:bg-green-700 text-white">Ativo</Badge>
                        ) : tenant.active ? (
                          <Badge className="bg-green-600 hover:bg-green-700 text-white">Ativa</Badge>
                        ) : (
                          <Badge variant="destructive">Inativa</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isMaster ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(sub)}
                            {sub && <span className="text-xs text-muted-foreground">{format(new Date(sub.expires_at), "dd/MM/yyyy")}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{repNome}</TableCell>
                      <TableCell className="text-xs">{format(new Date(tenant.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(tenant)}>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(tenant)}>Editar</DropdownMenuItem>
                            {sub && (
                              <DropdownMenuItem onClick={() => renewSubscription.mutate(tenant.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />Renovar (+30 dias)
                              </DropdownMenuItem>
                            )}
                            {!isMaster && sub && (
                              <DropdownMenuItem onClick={() => { setChangePlanTenant(tenant); setChangePlanId(sub.plan_id || ""); setChangePlanOpen(true); }}>
                                <ArrowUpDown className="h-4 w-4 mr-2" />Alterar Plano
                              </DropdownMenuItem>
                            )}
                            {!isMaster && (
                              <>
                                <DropdownMenuItem onClick={() => resendCredentials.mutate({ tenantId: tenant.id })}>
                                  <KeyRound className="h-4 w-4 mr-2" />Reenviar credenciais
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleTenantActive.mutate({ tenantId: tenant.id, active: !tenant.active })}>
                                  <Power className="h-4 w-4 mr-2" />{tenant.active ? "Inativar empresa" : "Ativar empresa"}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setTenantToDelete(tenant); setDeleteConfirmOpen(true); }}>
                                  <Trash2 className="h-4 w-4 mr-2" />Excluir empresa
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Empresa</DialogTitle>
            <DialogDescription>Informações completas da empresa.</DialogDescription>
          </DialogHeader>
          {selectedTenant && (() => {
            const sub = getSubForTenant(selectedTenant.id);
            const s = getSettings(selectedTenant);
            const rep = s?.representante || {};
            return (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 text-sm pr-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Dados da Empresa</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-medium">Nome Fantasia:</span> {selectedTenant.name}</div>
                      <div><span className="font-medium">Razão Social:</span> {s?.razaoSocial || "—"}</div>
                      <div><span className="font-medium">CNPJ:</span> {selectedTenant.cnpj || "—"}</div>
                      <div><span className="font-medium">Tipo:</span> <span className="capitalize">{s?.tipo || "—"}</span></div>
                      <div><span className="font-medium">Telefone:</span> {s?.telefone || "—"}</div>
                      <div><span className="font-medium">Email:</span> {s?.email || "—"}</div>
                      <div><span className="font-medium">Receita Anual:</span> {s?.receitaAnual || "—"}</div>
                      <div><span className="font-medium">Slug:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedTenant.slug}</code></div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-2"><User className="h-3.5 w-3.5" /> Representante Legal</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-medium">Nome:</span> {rep.nome || "—"}</div>
                      <div><span className="font-medium">Email:</span> {rep.email || "—"}</div>
                      <div><span className="font-medium">CPF:</span> {rep.documento || "—"}</div>
                      <div><span className="font-medium">Nascimento:</span> {rep.nascimento || "—"}</div>
                      <div><span className="font-medium">Renda Mensal:</span> {rep.rendaMensal || "—"}</div>
                      <div><span className="font-medium">Ocupação:</span> {rep.ocupacao || "—"}</div>
                      <div><span className="font-medium">Celular:</span> {rep.celular || "—"}</div>
                    </div>
                  </div>

                  {sub && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Assinatura</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="font-medium">Plano:</span> {sub.plans?.name || "—"}</div>
                          <div><span className="font-medium">Status:</span> {getStatusBadge(sub)}</div>
                          <div><span className="font-medium">Início:</span> {format(new Date(sub.started_at), "dd/MM/yyyy")}</div>
                          <div><span className="font-medium">Vencimento:</span> {format(new Date(sub.expires_at), "dd/MM/yyyy")}</div>
                          <div><span className="font-medium">Renovações:</span> {sub.renewal_count || 0}</div>
                          {sub.renewed_at && <div><span className="font-medium">Última renovação:</span> {format(new Date(sub.renewed_at), "dd/MM/yyyy HH:mm")}</div>}
                          {sub.stripe_subscription_id && <div className="col-span-2"><span className="font-medium">Stripe ID:</span> <code className="text-xs bg-muted px-1 py-0.5 rounded">{sub.stripe_subscription_id}</code></div>}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div><span className="font-medium">ID:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedTenant.id}</code></div>
                  <div><span className="font-medium">Criado em:</span> {format(new Date(selectedTenant.created_at), "dd/MM/yyyy HH:mm")}</div>
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Editar Empresa</DialogTitle>
            <DialogDescription>Atualize todos os dados da empresa.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 py-2 pr-4">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Dados da Empresa</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Fantasia *</Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Razão Social</Label>
                    <Input value={editForm.razaoSocial} onChange={(e) => setEditForm(f => ({ ...f, razaoSocial: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={editForm.cnpj} onChange={(e) => setEditForm(f => ({ ...f, cnpj: formatCpfCnpj(e.target.value) }))} maxLength={18} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={editForm.tipo} onValueChange={(v) => setEditForm(f => ({ ...f, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                        <SelectItem value="construtora">Construtora</SelectItem>
                        <SelectItem value="administradora">Administradora</SelectItem>
                        <SelectItem value="corretor_autonomo">Corretor Autônomo</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={editForm.telefone} onChange={(e) => setEditForm(f => ({ ...f, telefone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email da Empresa</Label>
                    <Input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={editForm.slug} onChange={(e) => setEditForm(f => ({ ...f, slug: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Receita Anual</Label>
                    <Input value={editForm.receitaAnual} onChange={(e) => setEditForm(f => ({ ...f, receitaAnual: e.target.value }))} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2"><User className="h-4 w-4" /> Representante Legal</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Representante</Label>
                    <Input value={editForm.repNome} onChange={(e) => setEditForm(f => ({ ...f, repNome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email do Representante</Label>
                    <Input type="email" value={editForm.repEmail} onChange={(e) => setEditForm(f => ({ ...f, repEmail: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input value={editForm.repDocumento} onChange={(e) => setEditForm(f => ({ ...f, repDocumento: formatCpfCnpj(e.target.value) }))} maxLength={14} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={editForm.repNascimento} onChange={(e) => setEditForm(f => ({ ...f, repNascimento: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Celular</Label>
                    <Input value={editForm.repCelular} onChange={(e) => setEditForm(f => ({ ...f, repCelular: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ocupação</Label>
                    <Input value={editForm.repOcupacao} onChange={(e) => setEditForm(f => ({ ...f, repOcupacao: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Renda Mensal</Label>
                    <Input value={editForm.repRendaMensal} onChange={(e) => setEditForm(f => ({ ...f, repRendaMensal: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={updateTenant.isPending || !editForm.name.trim()}
              onClick={() => updateTenant.mutate()}
            >
              {updateTenant.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Tenant Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa com dados completos e vincule a um plano.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 py-2 pr-4">
              {/* Company Data */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Dados da Empresa</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Fantasia *</Label>
                    <Input value={newForm.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Ex: Imobiliária ABC" />
                  </div>
                  <div className="space-y-2">
                    <Label>Razão Social</Label>
                    <Input value={newForm.razaoSocial} onChange={(e) => updateField("razaoSocial", e.target.value)} placeholder="Razão Social Ltda" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={newForm.cnpj} onChange={(e) => updateField("cnpj", formatCpfCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newForm.tipo} onValueChange={(v) => updateField("tipo", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                        <SelectItem value="construtora">Construtora</SelectItem>
                        <SelectItem value="administradora">Administradora</SelectItem>
                        <SelectItem value="corretor_autonomo">Corretor Autônomo</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={newForm.telefone} onChange={(e) => updateField("telefone", e.target.value)} placeholder="(11) 3000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email da Empresa</Label>
                    <Input type="email" value={newForm.email} onChange={(e) => updateField("email", e.target.value)} placeholder="contato@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={newForm.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="gerado automaticamente se vazio" />
                  </div>
                  <div className="space-y-2">
                    <Label>Receita Anual</Label>
                    <Input value={newForm.receitaAnual} onChange={(e) => updateField("receitaAnual", e.target.value)} placeholder="Ex: R$ 500.000" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Representative / Admin User */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2"><User className="h-4 w-4" /> Representante Legal / Usuário Admin</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Representante *</Label>
                    <Input value={newForm.repNome} onChange={(e) => updateField("repNome", e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email do Representante *</Label>
                    <Input type="email" value={newForm.repEmail} onChange={(e) => updateField("repEmail", e.target.value)} placeholder="rep@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF do Representante</Label>
                    <Input value={newForm.repDocumento} onChange={(e) => updateField("repDocumento", formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={newForm.repNascimento} onChange={(e) => updateField("repNascimento", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Celular</Label>
                    <Input value={newForm.repCelular} onChange={(e) => updateField("repCelular", e.target.value)} placeholder="(11) 99999-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ocupação</Label>
                    <Input value={newForm.repOcupacao} onChange={(e) => updateField("repOcupacao", e.target.value)} placeholder="Corretor de Imóveis" />
                  </div>
                  <div className="space-y-2">
                    <Label>Renda Mensal</Label>
                    <Input value={newForm.repRendaMensal} onChange={(e) => updateField("repRendaMensal", e.target.value)} placeholder="Ex: R$ 10.000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha inicial (opcional)</Label>
                    <Input type="password" value={newForm.adminPassword} onChange={(e) => updateField("adminPassword", e.target.value)} placeholder="Gerada automaticamente se vazio" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Subscription */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Plano & Assinatura</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plano *</Label>
                    <Select value={newForm.plan_id} onValueChange={(v) => updateField("plan_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — R${p.price_monthly}/mês {p.max_users ? `(${p.max_users} usuários)` : "(ilimitado)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    const selPlan = plans.find((p) => p.id === newForm.plan_id);
                    const isTrial = selPlan?.price_monthly === 0;
                    return isTrial ? (
                      <div className="space-y-2">
                        <Label>Duração da assinatura</Label>
                        <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted">7 dias (período de teste)</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Duração da assinatura (meses)</Label>
                        <Input type="number" min="1" value={newForm.duration_months} onChange={(e) => updateField("duration_months", e.target.value)} />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              disabled={createTenant.isPending || !newForm.name.trim() || !newForm.plan_id}
              onClick={() => createTenant.mutate()}
            >
              {createTenant.isPending ? "Criando..." : "Criar Empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{tenantToDelete?.name}</strong>? Esta ação é irreversível e removerá todos os dados associados (usuários, assinaturas, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => tenantToDelete && deleteTenant.mutate(tenantToDelete.id)}
            >
              {deleteTenant.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Change Plan Dialog */}
      <Dialog open={changePlanOpen} onOpenChange={(open) => { setChangePlanOpen(open); if (!open) { setChangePlanTenant(null); setChangePlanId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              Altere o plano da empresa <strong>{changePlanTenant?.name}</strong>. A mudança será bonificada e refletida apenas na próxima fatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Novo Plano</Label>
              <Select value={changePlanId} onValueChange={setChangePlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.price_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>Cancelar</Button>
            <Button
              disabled={!changePlanId || changePlan.isPending}
              onClick={() => changePlanTenant && changePlan.mutate({ tenantId: changePlanTenant.id, planId: changePlanId })}
            >
              {changePlan.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
