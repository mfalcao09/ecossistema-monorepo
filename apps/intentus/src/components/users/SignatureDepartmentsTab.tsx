import { useState } from "react";
import { useSignatureDepartments } from "@/hooks/useSignatureDepartments";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, UserPlus, PenTool, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEPT_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];

export function SignatureDepartmentsTab() {
  const { tenantId } = useAuth();
  const {
    departments, allTeams, members, isLoading,
    createDepartment, toggleDepartment, deleteDepartment, updateDepartment, addMember, removeMember,
  } = useSignatureDepartments();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(DEPT_COLORS[0]);
  const [addMemberDeptId, setAddMemberDeptId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["tenant-users-sig-depts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const nonDeptTeams = allTeams.filter((t: any) => !t.is_signature_department);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createDepartment({ name: newName, description: newDesc || undefined, color: newColor });
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
  };

  const handleAddMember = async () => {
    if (!addMemberDeptId || !selectedUser) return;
    await addMember.mutateAsync({ teamId: addMemberDeptId, userId: selectedUser });
    setSelectedUser("");
    setAddMemberDeptId(null);
  };

  const getMembersForDept = (deptId: string) => members.filter((m: any) => m.team_id === deptId);
  const getUserName = (userId: string) => allUsers.find((u) => u.user_id === userId)?.name || "Usuário";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie os departamentos disponíveis no módulo de Assinaturas Digitais e seus membros.
        </p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1.5" />Novo Departamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Departamento de Assinatura</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do departamento" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Descrição (opcional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Cor</Label>
                <div className="flex gap-2">
                  {DEPT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : departments.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            <PenTool className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum departamento de assinatura criado. Crie um departamento ou marque uma equipe existente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept: any) => {
            const deptMembers = getMembersForDept(dept.id);
            return (
              <Card key={dept.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color || "#8b5cf6" }} />
                      {editingDeptId === dept.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 text-sm w-40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editName.trim()) {
                                updateDepartment.mutate({ id: dept.id, name: editName.trim() } as any);
                                setEditingDeptId(null);
                              }
                              if (e.key === "Escape") setEditingDeptId(null);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { if (editName.trim()) { updateDepartment.mutate({ id: dept.id, name: editName.trim() } as any); } setEditingDeptId(null); }}>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingDeptId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <CardTitle className="text-base">{dept.name}</CardTitle>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {editingDeptId !== dept.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingDeptId(dept.id); setEditName(dept.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAddMemberDeptId(dept.id)}>
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteDepartment.mutate(dept.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {dept.description && <p className="text-xs text-muted-foreground">{dept.description}</p>}
                </CardHeader>
                <CardContent>
                  {deptMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum membro.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {deptMembers.map((m: any) => (
                        <Badge key={m.id} variant="secondary" className="gap-1">
                          {getUserName(m.user_id)}
                          <button onClick={() => removeMember.mutate(m.id)} className="ml-0.5 hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Toggle existing teams as departments */}
      {nonDeptTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Marcar equipes existentes como departamento</h3>
          <div className="space-y-2">
            {nonDeptTeams.map((team: any) => (
              <div key={team.id} className="flex items-center justify-between border rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || "#888" }} />
                  <span className="text-sm font-medium">{team.name}</span>
                </div>
                <Switch
                  checked={false}
                  onCheckedChange={() => toggleDepartment(team.id, true)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add member dialog */}
      <Dialog open={!!addMemberDeptId} onOpenChange={() => setAddMemberDeptId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Membro ao Departamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
              <SelectContent>
                {allUsers
                  .filter((u) => !members.some((m: any) => m.team_id === addMemberDeptId && m.user_id === u.user_id))
                  .map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddMember} disabled={!selectedUser} className="w-full">Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
