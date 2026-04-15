import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export function useTeams() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: ["teams", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["team-members", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTeam = useMutation({
    mutationFn: async (team: { name: string; description?: string; manager_user_id?: string; color?: string; is_signature_department?: boolean }) => {
      const tid = await getAuthTenantId();
      const { error } = await supabase.from("teams").insert({ ...team, tenant_id: tid } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Equipe criada");
    },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; manager_user_id?: string | null; color?: string; active?: boolean; is_signature_department?: boolean }) => {
      const { error } = await supabase.from("teams").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Equipe atualizada");
    },
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Equipe removida");
    },
  });

  const addMember = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const tid = await getAuthTenantId();
      const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId, tenant_id: tid });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro adicionado");
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro removido");
    },
  });

  return {
    teams: teamsQuery.data ?? [],
    members: membersQuery.data ?? [],
    isLoading: teamsQuery.isLoading,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
  };
}
