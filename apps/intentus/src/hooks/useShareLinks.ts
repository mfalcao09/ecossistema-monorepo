/**
 * useShareLinks — Hook para gerenciar links expiráveis de relatórios (US-31)
 * Sessão 146 — Bloco K
 *
 * Actions: create_link, list_links, revoke_link
 * Usa supabase.functions.invoke() (NUNCA fetch com Bearer user.id)
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareLink {
  id: string;
  token: string;
  url?: string;
  report_type: "executivo" | "tecnico";
  expires_at: string;
  created_at?: string;
  accessed_count?: number;
  is_active?: boolean;
  expires_in_hours?: number;
}

export interface UseShareLinksReturn {
  links: ShareLink[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  createLink: (params: {
    tenantId: string;
    developmentId: string;
    reportType?: "executivo" | "tecnico";
    expiresInHours?: number;
    createdBy: string;
  }) => Promise<ShareLink | null>;
  listLinks: (tenantId: string, developmentId: string) => Promise<void>;
  revokeLink: (tenantId: string, linkId: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useShareLinks(): UseShareLinksReturn {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── CREATE LINK ───
  const createLink = useCallback(
    async (params: {
      tenantId: string;
      developmentId: string;
      reportType?: "executivo" | "tecnico";
      expiresInHours?: number;
      createdBy: string;
    }): Promise<ShareLink | null> => {
      setIsCreating(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "report-share-link",
          {
            body: {
              action: "create_link",
              tenant_id: params.tenantId,
              development_id: params.developmentId,
              report_type: params.reportType ?? "tecnico",
              expires_in_hours: params.expiresInHours ?? 72,
              created_by: params.createdBy,
            },
          },
        );

        if (fnError) {
          setError(fnError.message ?? "Erro ao criar link");
          return null;
        }

        if (data?.error) {
          setError(data.error.message ?? "Erro ao criar link");
          return null;
        }

        const newLink = data?.link as ShareLink;
        if (newLink) {
          setLinks((prev) => [newLink, ...prev]);
        }
        return newLink ?? null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado";
        setError(msg);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  // ─── LIST LINKS ───
  const listLinks = useCallback(
    async (tenantId: string, developmentId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "report-share-link",
          {
            body: {
              action: "list_links",
              tenant_id: tenantId,
              development_id: developmentId,
            },
          },
        );

        if (fnError) {
          setError(fnError.message ?? "Erro ao listar links");
          return;
        }

        if (data?.error) {
          setError(data.error.message ?? "Erro ao listar links");
          return;
        }

        setLinks((data?.links as ShareLink[]) ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ─── REVOKE LINK ───
  const revokeLink = useCallback(
    async (tenantId: string, linkId: string): Promise<boolean> => {
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "report-share-link",
          {
            body: {
              action: "revoke_link",
              tenant_id: tenantId,
              link_id: linkId,
            },
          },
        );

        if (fnError) {
          setError(fnError.message ?? "Erro ao revogar link");
          return false;
        }

        if (data?.error) {
          setError(data.error.message ?? "Erro ao revogar link");
          return false;
        }

        // Remove from local state
        setLinks((prev) =>
          prev.map((l) =>
            l.id === linkId ? { ...l, is_active: false } : l,
          ),
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado";
        setError(msg);
        return false;
      }
    },
    [],
  );

  return {
    links,
    isLoading,
    isCreating,
    error,
    createLink,
    listLinks,
    revokeLink,
  };
}
