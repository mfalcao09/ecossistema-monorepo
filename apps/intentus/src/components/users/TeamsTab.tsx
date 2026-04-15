import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEAM_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export function TeamsTab() {
  const { tenantId } = useAuth();
  const { teams, members, isLoading, createTeam, deleteTeam, addMember, removeMember } = useTeams();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);
  const [newIsSignatureDept, setNewIsSignatureDept] = useState(false);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["tenant-users-teams", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").eq("tenant_id", tenantId!).eq("active", true).order("name");
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createTeam.mutateAsync({ name: newName, description: newDesc || undefined, color: newColor, is_signature_department: newIsSignatureDept });
    setNewName("");
    setNewDesc("");
    setNewIsSignatureDept(false);
    setShowCreate(false);
  };

  const handleAddMember = async () => {
    if (!addMemberTeamId || !selectedUser) return;
    await addMember.mutateAsync({ teamId: addMemberTeamId, userId: selectedUser });
    setSelectedUser("");
    setAddMemberTeamId(null);
  };

  const getMembersForTeam = (teamId: string) => members.filter((m) => m.team_id === teamId);
  const getUserName = (userId: string) => allUsers.find((u) => u.user_id === userId)?.name || "Usuário";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1.5" />Nova Equipe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Equipe</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome da equipe" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Descrição (opcional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cor</label>
                <div className="flex gap-2">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Acesso ao módulo de Assinatura</label>
                <Switch checked={newIsSignatureDept} onCheckedChange={setNewIsSignatureDept} />
              </div>
              <Button onClick={handleCreate} disabled={createTeam.isPending} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : teams.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">Nenhuma equipe criada.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const teamMembers = getMembersForTeam(team.id);
            return (
              <Card key={team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || "#888" }} />
                      <CardTitle className="text-base">{team.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAddMemberTeamId(team.id)}>
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTeam.mutate(team.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                </CardHeader>
                <CardContent>
                  {teamMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum membro.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {teamMembers.map((m) => (
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

      <Dialog open={!!addMemberTeamId} onOpenChange={() => setAddMemberTeamId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Membro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
              <SelectContent>
                {allUsers
                  .filter((u) => !members.some((m) => m.team_id === addMemberTeamId && m.user_id === u.user_id))
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
