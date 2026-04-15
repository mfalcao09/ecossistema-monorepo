import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";

export function useSignatureDepartments() {
  const { tenantId, user, isAdminOrGerente, hasRole } = useAuth();
  const { teams, members, isLoading: teamsLoading, createTeam, updateTeam, deleteTeam, addMember, removeMember } = useTeams();

  const isSuperAdmin = hasRole("superadmin" as any);
  const canSeeAll = isAdminOrGerente || isSuperAdmin;

  const departments = teams.filter((t: any) => t.is_signature_department === true);

  const myDepartments = canSeeAll
    ? departments
    : departments.filter((d: any) =>
        members.some((m: any) => m.team_id === d.id && m.user_id === user?.id)
      );

  const envelopeCountsQuery = useQuery({
    queryKey: ["sig-dept-counts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_envelopes")
        .select("department_team_id")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((e: any) => {
        const key = e.department_team_id || "__none__";
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
  });

  const createDepartment = async (dept: { name: string; description?: string; color?: string }) => {
    await createTeam.mutateAsync({ ...dept, is_signature_department: true } as any);
  };

  const toggleDepartment = async (teamId: string, value: boolean) => {
    await updateTeam.mutateAsync({ id: teamId, is_signature_department: value } as any);
  };

  return {
    departments,
    myDepartments,
    allTeams: teams,
    members,
    envelopeCounts: envelopeCountsQuery.data ?? {},
    isLoading: teamsLoading || envelopeCountsQuery.isLoading,
    canSeeAll,
    createDepartment,
    toggleDepartment,
    deleteDepartment: deleteTeam,
    updateDepartment: updateTeam,
    addMember,
    removeMember,
  };
}
