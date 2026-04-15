import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useTablePreferences(pageKey: string, defaultColumns: string[]) {
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  const { data: visibleColumns, isLoading } = useQuery({
    queryKey: ["table-preferences", pageKey, user?.id ?? "anon"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return defaultColumns;

      const { data, error } = await supabase
        .from("user_table_preferences" as any)
        .select("visible_columns")
        .eq("page_key", pageKey)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading table preferences:", error);
        return defaultColumns;
      }

      return (data as any)?.visible_columns ?? defaultColumns;
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (columns: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Get tenant_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");

      const { error } = await (supabase.from("user_table_preferences" as any) as any)
        .upsert(
          {
            user_id: user.id,
            page_key: pageKey,
            visible_columns: columns,
            tenant_id: profile.tenant_id,
          },
          { onConflict: "user_id,page_key,tenant_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table-preferences", pageKey] });
    },
  });

  const savePreferences = useCallback(
    (columns: string[]) => {
      // Optimistic update
      qc.setQueryData(["table-preferences", pageKey, user?.id ?? "anon"], columns);

      // Debounce the actual save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutation.mutate(columns);
      }, 500);
    },
    [pageKey, qc, mutation]
  );

  return {
    visibleColumns: visibleColumns ?? defaultColumns,
    isLoading,
    savePreferences,
  };
}
