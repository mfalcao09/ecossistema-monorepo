import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useRef, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2,
  Tag,
  TrendingUp,
  DollarSign,
  Users,
  ClipboardList,
  Clock,
  Calendar,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardFieldDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  /** If true the field is always visible and cannot be toggled off */
  required?: boolean;
  /** Brief description shown in the customizer dialog */
  description?: string;
}

export interface CardPreferences {
  /** Ordered list of visible field ids (required fields always prepended) */
  visibleFields: string[];
  /** Compact mode — reduces padding / font size */
  compact: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All card fields available for customization.
 * Order here = default display order.
 */
export const ALL_CARD_FIELDS: CardFieldDefinition[] = [
  {
    id: "property_title",
    label: "Nome do Imóvel",
    icon: Building2,
    required: true,
    description: "Título do imóvel vinculado ao negócio",
  },
  {
    id: "status_badge",
    label: "Status",
    icon: Tag,
    required: true,
    description: "Badge de status atual do negócio",
  },
  {
    id: "sale_stage",
    label: "Etapa de Venda",
    icon: TrendingUp,
    description: "Badge de etapa do funil de venda (só vendas)",
  },
  {
    id: "deal_type",
    label: "Tipo de Negócio",
    icon: Building2,
    description: "Venda, Locação ou Administração",
  },
  {
    id: "proposed_value",
    label: "Valor Proposto",
    icon: DollarSign,
    description: "Valor de venda ou aluguel mensal proposto",
  },
  {
    id: "parties",
    label: "Partes Envolvidas",
    icon: Users,
    description: "Nomes das partes vinculadas ao negócio",
  },
  {
    id: "commercial_notes",
    label: "Observações Comerciais",
    icon: ClipboardList,
    description: "Notas do corretor sobre o negócio",
  },
  {
    id: "due_date",
    label: "Data de Vencimento",
    icon: Clock,
    description: "Prazo limite para conclusão do negócio",
  },
  {
    id: "created_date",
    label: "Data de Criação",
    icon: Calendar,
    description: "Data de criação do negócio",
  },
];

export const REQUIRED_FIELD_IDS = ALL_CARD_FIELDS
  .filter((f) => f.required)
  .map((f) => f.id);

export const DEFAULT_VISIBLE_FIELDS = ALL_CARD_FIELDS.map((f) => f.id);

const DEFAULT_PREFERENCES: CardPreferences = {
  visibleFields: DEFAULT_VISIBLE_FIELDS,
  compact: false,
};

const PAGE_KEY = "kanban-card-fields";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCardPreferences() {
  const qc = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  const queryKey = useMemo(
    () => ["card-preferences", PAGE_KEY, user?.id ?? "anon"],
    [user?.id],
  );

  // ---- Cleanup debounce on unmount ----------------------------------------
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- Read ----------------------------------------------------------------
  const { data: preferences, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return DEFAULT_PREFERENCES;

      const { data, error } = await supabase
        .from("user_table_preferences" as any)
        .select("visible_columns")
        .eq("page_key", PAGE_KEY)
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading card preferences:", error);
        return DEFAULT_PREFERENCES;
      }

      const raw = (data as any)?.visible_columns as string[] | null;
      if (!raw || raw.length === 0) return DEFAULT_PREFERENCES;

      // Parse: first element may be JSON for extended prefs
      try {
        const first = raw[0];
        if (first.startsWith("{")) {
          const parsed = JSON.parse(first) as CardPreferences;
          // Ensure required fields are always present
          const clean = ensureRequiredFields(parsed.visibleFields);
          return { visibleFields: clean, compact: !!parsed.compact };
        }
      } catch {
        // Not JSON — treat as plain string array (backward compat)
      }

      return {
        visibleFields: ensureRequiredFields(raw),
        compact: false,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // ---- Write ---------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: async (prefs: CardPreferences) => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", authUser.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");

      // Store as a single JSON string inside the string[] column
      const payload = [JSON.stringify(prefs)];

      const { error } = await (
        supabase.from("user_table_preferences" as any) as any
      ).upsert(
        {
          user_id: authUser.id,
          page_key: PAGE_KEY,
          visible_columns: payload,
          tenant_id: profile.tenant_id,
        },
        { onConflict: "user_id,page_key,tenant_id" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      // Rollback optimistic update on failure
      qc.invalidateQueries({ queryKey });
      console.error("Error saving card preferences:", err);
    },
  });

  // ---- Save (debounced) ----------------------------------------------------
  const savePreferences = useCallback(
    (prefs: CardPreferences) => {
      // Optimistic update
      qc.setQueryData(queryKey, prefs);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutation.mutate(prefs);
      }, 500);
    },
    [queryKey, qc, mutation],
  );

  // ---- Reset ---------------------------------------------------------------
  const resetToDefaults = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  // ---- Helpers -------------------------------------------------------------
  const isFieldVisible = useCallback(
    (fieldId: string) => {
      const prefs = preferences ?? DEFAULT_PREFERENCES;
      return prefs.visibleFields.includes(fieldId);
    },
    [preferences],
  );

  return {
    preferences: preferences ?? DEFAULT_PREFERENCES,
    isLoading,
    savePreferences,
    resetToDefaults,
    isFieldVisible,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function ensureRequiredFields(fields: string[]): string[] {
  const result = [...fields];
  for (const req of REQUIRED_FIELD_IDS) {
    if (!result.includes(req)) {
      result.unshift(req);
    }
  }
  // Remove any field ids that don't exist in ALL_CARD_FIELDS
  const validIds = new Set(ALL_CARD_FIELDS.map((f) => f.id));
  return result.filter((id) => validIds.has(id));
}
