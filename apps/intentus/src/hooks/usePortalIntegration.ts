import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PortalStats {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
}

export interface PropertyStatus {
  id: string;
  title: string;
  propertyCode: string | null;
  propertyType: string;
  purpose: string;
  city: string | null;
  neighborhood: string | null;
  salePrice: number;
  rentalPrice: number;
  photoCount: number;
  publishedPortals: string[];
  vrsyncValid: boolean;
  olxValid: boolean;
  vrsyncErrors: number;
  olxErrors: number;
}

export interface PortalDashboard {
  totalProperties: number;
  availableProperties: number;
  portalStats: Record<string, PortalStats>;
  propertyStatuses: PropertyStatus[];
  portalSettings: Record<string, any>;
}

export interface ValidationError {
  propertyId: string;
  title: string;
  portal: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  totalProperties: number;
  validVrSync: number;
  validOLX: number;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
}

export interface GeneratedXML {
  xml: string;
  format: string;
  propertyCount: number;
  generatedAt: string;
}

export interface PropertyPortalStatus {
  property: { id: string; title: string; propertyCode: string | null; publishedPortals: string[] };
  vrsync: { valid: boolean; errors: ValidationError[] };
  olx: { valid: boolean; errors: ValidationError[] };
  mediaCount: number;
  featureCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PORTAL_LABELS: Record<string, string> = {
  grupozap: "ZAP / VivaReal",
  olx: "OLX",
};

export const PORTAL_COLORS: Record<string, string> = {
  grupozap: "bg-purple-100 text-purple-700 border-purple-300",
  olx: "bg-orange-100 text-orange-700 border-orange-300",
};

export const PORTAL_FORMAT: Record<string, string> = {
  grupozap: "vrsync",
  olx: "olx",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  terreno: "Terreno",
  lote: "Lote",
  comercial: "Comercial",
  rural: "Rural",
  industrial: "Industrial",
};

export const PURPOSE_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Venda e Locação",
};

// ─── API caller ──────────────────────────────────────────────────────────────

async function callPortal(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-portal-integration", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro na chamada da EF");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function usePortalDashboard() {
  return useQuery<PortalDashboard>({
    queryKey: ["portal-integration", "dashboard"],
    queryFn: () => callPortal("get_dashboard"),
    staleTime: 60_000,
  });
}

export function useValidateProperties(format: "vrsync" | "olx" | "all" = "all") {
  return useMutation<ValidationResult, Error>({
    mutationFn: () => callPortal("validate_properties", { format }),
  });
}

export function useGenerateXML() {
  return useMutation<GeneratedXML, Error, { format: string; property_ids?: string[] }>({
    mutationFn: (params) => callPortal("generate_xml", params),
  });
}

export function useTogglePropertyPortal() {
  const qc = useQueryClient();
  return useMutation<any, Error, { property_id: string; portal: string; enabled: boolean }>({
    mutationFn: (params) => callPortal("toggle_property_portal", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-integration"] });
    },
  });
}

export function useUpdatePortalSettings() {
  const qc = useQueryClient();
  return useMutation<any, Error, Record<string, any>>({
    mutationFn: (portal_settings) => callPortal("update_portal_settings", { portal_settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-integration"] });
    },
  });
}

export function usePropertyPortalStatus(propertyId: string | null) {
  return useQuery<PropertyPortalStatus>({
    queryKey: ["portal-integration", "property", propertyId],
    queryFn: () => callPortal("get_property_status", { property_id: propertyId }),
    enabled: !!propertyId,
    staleTime: 30_000,
  });
}
