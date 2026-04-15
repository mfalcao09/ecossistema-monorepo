import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Shield, UserPlus, Search, Pencil, Copy, Check, UserX, UserCheck, MoreHorizontal, KeyRound } from "lucide-react";
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "corretor", label: "Corretor" },
  { value: "financeiro", label: "Financeiro" },
  { value: "juridico", label: "Jurídico" },
  { value: "manutencao", label: "Manutenção" },
] as const;

type AppRole = typeof ROLES[number]["value"];

interface UserWithRoles {
  user_id: string;
  name: string;
  department: string | null;
  active: boolean;
  roles: AppRole[];
}

function useUsersWithRoles(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin-users", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, name, department, active")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;

      const userIds = (profiles || []).map((p) => p.user_id);
      if (userIds.length === 0) return [] as UserWithRoles[];

      const { data: allRoles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (rErr) throw rErr;

      const roleMap = new Map<string, AppRole[]>();
      (allRoles || []).forEach((r) => {
        const arr = roleMap.get(r.user_id) || [];
        arr.push(r.role as AppRole);
        roleMap.set(r.user_id, arr);
      });

      return (profiles || []).map((p) => ({
        user_id: p.user_id,
        name: p.name || "Sem nome",
        department: p.department,
        active: (p as any).active !== false,
        roles: roleMap.get(p.user_id) || [],
      }))
      // Always hide superadmin users from the tenant user list
      .filter((u) => !u.roles.includes("superadmin" as any)) as UserWithRoles[];
    },
  });
}

function useUserLimit(tenantId: string | null) {
  return useQuery({
    queryKey: ["user-limit", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return { count: 0, max: null };

      const { data: tenant } = await supabase
        .from("tenants")
        .select("plan_id")
        .eq("id", tenantId)
        .single();

      let maxUsers: number | null = null;
      if (tenant?.plan_id) {
        const { data: plan } = await supabase
          .from("plans")
          .select("max_users")
          .eq("id", tenant.plan_id)
          .single();
        
        if (plan?.max_users) {
          // Include extra users purchased
          const { data: extras } = await supabase
            .from("tenant_extra_resources")
            .select("quantity")
            .eq("tenant_id", tenantId!)
            .eq("resource_type", "users")
            .eq("status", "ativo");

          const extraUsers = (extras ?? []).reduce((sum, e: any) => sum + (e.quantity || 0), 0);
          maxUsers = plan.max_users + extraUsers;
        }
      }

      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("active", true);

      const { data: saUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "superadmin" as any);

      return { count: Math.max(0, (count || 0) - (saUsers?.length || 0)), max: maxUsers };
    },
  });
}

export function UsersTab() {
  const { user, tenantId } = useAuth();
  const { data: users = [], isLoading } = useUsersWithRoles(tenantId);
  const { data: limit } = useUserLimit(tenantId);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserWithRoles | null>(null);

  const limitReached = limit?.max != null && limit.count >= limit.max;

  const updateRoles = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: AppRole[] }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      if (roles.length > 0) {
        const tenant_id = await getAuthTenantId();
        const { error } = await supabase
          .from("user_roles")
          .insert(roles.map((role) => ({ user_id: userId, role, tenant_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Roles atualizados!");
      setEditUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      const body: any = { email: inviteEmail, name: inviteName, role: inviteRole };
      if (invitePassword.trim()) body.password = invitePassword.trim();
      const { data, error } = await supabase.functions.invoke("invite-user", { body });
      if (error) throw new Error(error.message || "Erro ao convidar usuário");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setTempPassword(data.temp_password);
      setEmailSent(!!data.email_sent);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["user-limit"] });
      toast.success("Usuário criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, currentActive }: { userId: string; currentActive: boolean }) => {
      const newActive = !currentActive;
      if (newActive && limit?.max != null && limit.count >= limit.max) {
        throw new Error("Limite de usuários do plano atingido. Faça upgrade do plano.");
      }
      const { error } = await supabase
        .from("profiles")
        .update({ active: newActive } as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["user-limit"] });
      toast.success("Status do usuário atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetInvite = () => {
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("");
    setInvitePassword("");
    setTempPassword(null);
    setEmailSent(false);
    setCopied(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-3">
          {limit && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {limit.count} ativos / {limit.max ?? "∞"} limite
            </Badge>
          )}
          <Button onClick={() => setInviteOpen(true)} disabled={limitReached}>
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Usuário
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.user_id} className={!u.active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.department || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Sem role</span>
                        ) : (
                          u.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-xs">
                              {ROLES.find((x) => x.value === r)?.label || r}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditUser(u); setSelectedRoles([...u.roles]); }}>
                            <Pencil className="h-4 w-4 mr-2" />Editar Roles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetPasswordTarget(u)}>
                            <KeyRound className="h-4 w-4 mr-2" />Resetar Senha
                          </DropdownMenuItem>
                          {u.user_id !== user?.id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleActive.mutate({ userId: u.user_id, currentActive: u.active })}
                                disabled={toggleActive.isPending}
                              >
                                {u.active ? (
                                  <><UserX className="h-4 w-4 mr-2" />Inativar usuário</>
                                ) : (
                                  <><UserCheck className="h-4 w-4 mr-2" />Ativar usuário</>
                                )}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Roles Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Roles — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Selecione os cargos/permissões deste usuário:</p>
            {ROLES.map((r) => (
              <div key={r.value} className="flex items-center gap-3">
                <Checkbox
                  id={`role-${r.value}`}
                  checked={selectedRoles.includes(r.value)}
                  onCheckedChange={(checked) => {
                    setSelectedRoles((prev) => checked ? [...prev, r.value] : prev.filter((x) => x !== r.value));
                  }}
                />
                <Label htmlFor={`role-${r.value}`} className="cursor-pointer">{r.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={() => { if (editUser) updateRoles.mutate({ userId: editUser.user_id, roles: selectedRoles }); }} disabled={updateRoles.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInvite(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>O novo usuário receberá uma senha temporária para o primeiro acesso.</DialogDescription>
          </DialogHeader>
          {tempPassword ? (
            <div className="space-y-4 py-4">
              <p className="text-sm font-medium text-primary">Usuário criado com sucesso!</p>
              {emailSent ? (
                <div>
                  <p className="text-sm text-muted-foreground">A senha temporária foi enviada por e-mail para o usuário.</p>
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-muted-foreground">Senha definida</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">{tempPassword}</code>
                    <Button variant="outline" size="icon" onClick={handleCopyPassword}>
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Compartilhe esta senha com o usuário. Ele deverá alterá-la no primeiro acesso.</p>
                </div>
              )}
              <DialogFooter>
                <Button onClick={resetInvite}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Cargo / Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Senha provisória <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Deixe em branco para enviar por e-mail"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetInvite}>Cancelar</Button>
                <Button
                  onClick={() => inviteUser.mutate()}
                  disabled={!inviteName || !inviteEmail || !inviteRole || inviteUser.isPending}
                >
                  {inviteUser.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        open={!!resetPasswordTarget}
        onOpenChange={(open) => { if (!open) setResetPasswordTarget(null); }}
        userName={resetPasswordTarget?.name || "Usuário"}
        userId={resetPasswordTarget?.user_id || ""}
      />
    </div>
  );
}
