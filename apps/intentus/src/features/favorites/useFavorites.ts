// ============================================================
// Hook: useFavorites
// Queries e mutations para Property Favorites
// Padrões: React Query, supabase.functions.invoke, toast
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// ---- Types ----
export interface PropertyFavorite {
  id: string;
  property_id: string;
  notes: string | null;
  notify_on_change: boolean;
  created_at: string;
  properties: {
    id: string;
    title: string;
    street: string | null;
    city: string | null;
    state: string | null;
    neighborhood: string | null;
    status: string;
    purpose: string;
    property_type: string;
    sale_price: number | null;
    rental_price: number | null;
  } | null;
}

interface ToggleResult {
  toggled: "added" | "removed";
  favoriteId: string;
}

interface CheckResult {
  isFavorite: boolean;
  favoriteId: string | null;
}

interface CountResult {
  count: number;
}

// ---- Helper ----
async function invokeFavorites<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("property-favorites-api", {
    body: { action, ...params },
  });

  if (error) throw new Error(error.message || "Erro ao acessar favoritos");
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data as T;
}

// ---- Queries ----

export function useFavoritesList() {
  const { user, tenantId } = useAuth();

  return useQuery<PropertyFavorite[]>({
    queryKey: ["favorites", "list", user?.id, tenantId],
    queryFn: () => invokeFavorites<PropertyFavorite[]>("list"),
    enabled: !!user && !!tenantId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useFavoriteCheck(propertyId: string) {
  const { user, tenantId } = useAuth();

  return useQuery<CheckResult>({
    queryKey: ["favorites", "check", propertyId, user?.id, tenantId],
    queryFn: () => invokeFavorites<CheckResult>("check", { propertyId }),
    enabled: !!user && !!tenantId && !!propertyId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useFavoritesCount() {
  const { user, tenantId } = useAuth();

  return useQuery<CountResult>({
    queryKey: ["favorites", "count", user?.id, tenantId],
    queryFn: () => invokeFavorites<CountResult>("count"),
    enabled: !!user && !!tenantId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

// ---- Mutations ----

export function useFavoriteToggle() {
  const queryClient = useQueryClient();

  return useMutation<ToggleResult, Error, { propertyId: string }>({
    mutationFn: ({ propertyId }) =>
      invokeFavorites<ToggleResult>("toggle", { propertyId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(
        data.toggled === "added"
          ? "Imóvel adicionado aos favoritos"
          : "Imóvel removido dos favoritos"
      );
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar favorito"),
  });
}

export function useFavoriteUpdateNotes() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { favoriteId: string; notes: string | null }>({
    mutationFn: ({ favoriteId, notes }) =>
      invokeFavorites("update_notes", { favoriteId, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success("Notas atualizadas");
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar notas"),
  });
}

export function useFavoriteUpdateNotify() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { favoriteId: string; notifyOnChange: boolean }>({
    mutationFn: ({ favoriteId, notifyOnChange }) =>
      invokeFavorites("update_notify", { favoriteId, notifyOnChange }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar notificação"),
  });
}
