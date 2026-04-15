import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Users, MoreHorizontal, Shield, UserPlus, Copy, Check, Trash2, UserX, UserCheck, KeyRound } from "lucide-react";
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";

const ALL_ROLES = ["admin", "gerente", "corretor", "financeiro", "juridico", "manutencao", "superadmin"] as const;
const INVITE_ROLES = ["admin", "gerente", "corretor", "financeiro", "juridico", "manutencao"] as const;
const MASTER_UID = "85ba82c5-479d-4405-83ba-69359486780b";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  corretor: "Corretor",
  financeiro: "Financeiro",
  juridico: "Jurídico",
  manutencao: "Manutenção",
  superadmin: "SuperAdmin",
};

export default function SuperAdminUsers() {
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingRoles, setEditingRoles] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteTenantId, setInviteTenantId] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<any>(null);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["superadmin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, tenants(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["superadmin-all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, tenant_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["superadmin-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, plan_id, plans(max_users)")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const rolesByUser = allRoles.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.user_id]) acc[r.user_id] = [];
    acc[r.user_id].push(r.role);
    return acc;
  }, {});

  // Count ACTIVE users per tenant for limit display (excluding superadmin)
  const activeUsersPerTenant = useMemo(() => {
    const superadminUserIds = new Set(
      allRoles.filter((r) => r.role === "superadmin").map((r) => r.user_id)
    );
    const counts: Record<string, number> = {};
    profiles.forEach((p) => {
      if (p.tenant_id && (p as any).active !== false && !superadminUserIds.has(p.user_id)) {
        counts[p.tenant_id] = (counts[p.tenant_id] || 0) + 1;
      }
    });
    return counts;
  }, [profiles, allRoles]);

  const selectedTenantLimit = useMemo(() => {
    if (!inviteTenantId) return null;
    const t = tenants.find((t) => t.id === inviteTenantId);
    if (!t) return null;
    const maxUsers = (t as any).plans?.max_users ?? null;
    const count = activeUsersPerTenant[inviteTenantId] || 0;
    return { count, max: maxUsers };
  }, [inviteTenantId, tenants, activeUsersPerTenant]);

  const inviteLimitReached = selectedTenantLimit?.max != null && selectedTenantLimit.count >= selectedTenantLimit.max;

  const saveRoles = useMutation({
    mutationFn: async ({ userId, tenantId, roles }: { userId: string; tenantId: string; roles: string[] }) => {
      const currentRoles = rolesByUser[userId] ?? [];
      const toAdd = roles.filter((r) => !currentRoles.includes(r));
      const toRemove = currentRoles.filter((r) => !roles.includes(r));

      for (const role of toRemove) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
        if (error) throw error;
      }
      for (const role of toAdd) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any, tenant_id: tenantId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-all-roles"] });
      toast.success("Papéis atualizados!");
      setRolesDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      const body: any = { email: inviteEmail, name: inviteName, role: inviteRole, tenant_id: inviteTenantId };
      if (invitePassword.trim()) body.password = invitePassword.trim();
      const { data, error } = await supabase.functions.invoke("invite-user", { body });
      if (error) throw new Error(error.message || "Erro ao convidar usuário");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setTempPassword(data.temp_password);
      setEmailSent(!!data.email_sent);
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      toast.success("Usuário criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, currentActive, tenantId }: { userId: string; currentActive: boolean; tenantId: string }) => {
      const newActive = !currentActive;
      // If activating, check plan limit
      if (newActive) {
        const t = tenants.find((t) => t.id === tenantId);
        const maxUsers = (t as any)?.plans?.max_users ?? null;
        if (maxUsers != null) {
          const activeCount = activeUsersPerTenant[tenantId] || 0;
          if (activeCount >= maxUsers) {
            throw new Error(`Limite de ${maxUsers} usuários ativos atingido para esta empresa. É necessário upgrade do plano.`);
          }
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({ active: newActive } as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      toast.success("Status do usuário atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });
      if (error) throw new Error(error.message || "Erro ao excluir usuário");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      qc.invalidateQueries({ queryKey: ["superadmin-all-roles"] });
      toast.success("Usuário excluído com sucesso!");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = profiles.filter(
    (p) =>
      (p.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.user_id ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openRolesDialog = (profile: any) => {
    setSelectedProfile(profile);
    setEditingRoles(rolesByUser[profile.user_id] ?? []);
    setRolesDialogOpen(true);
  };

  const openDetailDialog = (profile: any) => {
    setSelectedProfile(profile);
    setDetailDialogOpen(true);
  };

  const toggleRole = (role: string) => {
    setEditingRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

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
    setInviteTenantId("");
    setInvitePassword("");
    setTempPassword(null);
    setEmailSent(false);
    setCopied(false);
  };

  const isMasterUser = (profile: any) => profile.user_id === MASTER_UID;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários da Plataforma</h1>
          <p className="text-muted-foreground">Visualize todos os usuários registrados em todas as empresas.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{profiles.length} usuários</Badge>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((profile) => {
                  const isActive = (profile as any).active !== false;
                  return (
                    <TableRow key={profile.id} className={!isActive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          {profile.name || "Sem nome"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(profile as any).tenants?.name || (
                          <span className="text-muted-foreground italic">Sem empresa</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(rolesByUser[profile.user_id] ?? []).map((role) => (
                            <Badge key={role} variant={role === "superadmin" ? "default" : "secondary"} className="text-xs">
                              {roleLabels[role] || role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(profile.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetailDialog(profile)}>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRolesDialog(profile)}>Alterar papéis</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetPasswordTarget(profile)}>
                              <KeyRound className="h-4 w-4 mr-2" />Resetar senha
                            </DropdownMenuItem>
                            {!isMasterUser(profile) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => toggleActive.mutate({ userId: profile.user_id, currentActive: isActive, tenantId: profile.tenant_id })}
                                  disabled={toggleActive.isPending}
                                >
                                  {isActive ? (
                                    <><UserX className="h-4 w-4 mr-2" />Inativar usuário</>
                                  ) : (
                                    <><UserCheck className="h-4 w-4 mr-2" />Ativar usuário</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(profile)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />Excluir usuário
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
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>Informações completas do usuário.</DialogDescription>
          </DialogHeader>
          {selectedProfile && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Nome:</span> {selectedProfile.name || "Sem nome"}</div>
              <div><span className="font-medium">Empresa:</span> {(selectedProfile as any).tenants?.name || "Sem empresa"}</div>
              <div><span className="font-medium">User ID:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedProfile.user_id}</code></div>
              <div><span className="font-medium">Status:</span> {(selectedProfile as any).active !== false ? "Ativo" : "Inativo"}</div>
              <div><span className="font-medium">Criado em:</span> {format(new Date(selectedProfile.created_at), "dd/MM/yyyy HH:mm")}</div>
              <div>
                <span className="font-medium">Papéis:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(rolesByUser[selectedProfile.user_id] ?? []).map((role) => (
                    <Badge key={role} variant="secondary" className="text-xs">{roleLabels[role] || role}</Badge>
                  ))}
                  {(rolesByUser[selectedProfile.user_id] ?? []).length === 0 && (
                    <span className="text-muted-foreground italic">Nenhum papel atribuído</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Roles Dialog */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Alterar Papéis
            </DialogTitle>
            <DialogDescription>
              {selectedProfile?.name || "Usuário"} — {(selectedProfile as any)?.tenants?.name || "Sem empresa"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ALL_ROLES.filter((r) => r !== "superadmin" || user?.id === MASTER_UID).map((role) => (
              <div key={role} className="flex items-center gap-3">
                <Checkbox id={`role-${role}`} checked={editingRoles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                <Label htmlFor={`role-${role}`} className="cursor-pointer">{roleLabels[role]}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={saveRoles.isPending}
              onClick={() => {
                if (!selectedProfile) return;
                saveRoles.mutate({ userId: selectedProfile.user_id, tenantId: selectedProfile.tenant_id, roles: editingRoles });
              }}
            >
              {saveRoles.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O usuário <strong>{deleteTarget?.name}</strong> será removido permanentemente do sistema, incluindo todos os dados de autenticação e perfil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.user_id)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Excluindo..." : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <p className="text-xs text-muted-foreground mt-2">Compartilhe esta senha com o usuário.</p>
                </div>
              )}
              <DialogFooter>
                <Button onClick={resetInvite}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={inviteTenantId} onValueChange={setInviteTenantId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTenantLimit && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTenantLimit.count} ativos / {selectedTenantLimit.max ?? "∞"} limite
                    {inviteLimitReached && <span className="text-destructive ml-1 font-medium">— Limite atingido</span>}
                  </p>
                )}
              </div>
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
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
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
                  disabled={!inviteName || !inviteEmail || !inviteRole || !inviteTenantId || inviteLimitReached || inviteUser.isPending}
                >
                  {inviteUser.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={!!resetPasswordTarget}
        onOpenChange={(open) => { if (!open) setResetPasswordTarget(null); }}
        userName={resetPasswordTarget?.name || "Usuário"}
        userId={resetPasswordTarget?.user_id || ""}
      />
    </div>
  );
}
