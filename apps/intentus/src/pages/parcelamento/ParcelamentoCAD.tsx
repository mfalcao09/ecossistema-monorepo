import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCadProject } from "@/hooks/useCadProject";
import { CADEditor } from "@/components/parcelamento/cad/CADEditor";
import { CADCanvasState, DEFAULT_SETTINGS, DEFAULT_LAYERS } from "@/types/cad";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ParcelamentoCAD() {
  const { id: developmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();

  const { project, loading, saving, error, loadOrCreate, saveCanvas } = useCadProject();

  const [developmentData, setDevelopmentData] = useState<{
    name: string;
    centroid?: unknown;
    geometry?: unknown;
    geometry_coordinates?: unknown;
  } | null>(null);

  // Load development info
  useEffect(() => {
    if (!developmentId) return;
    supabase
      .from("developments")
      .select("name, centroid, geometry_coordinates, area_m2")
      .eq("id", developmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDevelopmentData(data);
      });
  }, [developmentId]);

  // Load or create CAD project
  useEffect(() => {
    if (!developmentId) return;
    loadOrCreate(developmentId, session?.user?.id);
  }, [developmentId, session?.user?.id, loadOrCreate]);

  // Handle save
  async function handleSave(
    elements: CADCanvasState["elements"],
    layers: CADCanvasState["layers"]
  ) {
    if (!project?.id) return;
    const canvasState: CADCanvasState = {
      elements,
      layers,
      viewport: undefined,
    };
    const ok = await saveCanvas(project.id, canvasState);
    if (ok) {
      toast.success("Projeto salvo com sucesso!");
    } else {
      toast.error("Erro ao salvar projeto.");
    }
  }

  // Get initial viewport from development centroid
  function getInitialViewport(): { center: [number, number]; zoom: number } | undefined {
    if (!developmentData?.centroid) return undefined;
    try {
      // centroid may be a WKT string like "POINT(-47.9292 -22.0056)" or GeoJSON
      const centroid = developmentData.centroid as string | { coordinates: [number, number] };
      if (typeof centroid === "string") {
        const match = centroid.match(/POINT\(([^ ]+) ([^ )]+)\)/);
        if (match) {
          return { center: [parseFloat(match[1]), parseFloat(match[2])], zoom: 16 };
        }
      } else if (centroid?.coordinates) {
        return { center: centroid.coordinates, zoom: 16 };
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  // Get development geometry for boundary display
  function getDevelopmentGeometry(): GeoJSON.Geometry | null {
    if (!developmentData) return null;
    try {
      const gc = developmentData.geometry_coordinates;
      if (gc && typeof gc === "object") {
        // geometry_coordinates is stored as a GeoJSON-like object
        return {
          type: "Polygon",
          coordinates: (gc as { coordinates: unknown[] }).coordinates ?? gc,
        } as GeoJSON.Geometry;
      }
    } catch {
      // ignore
    }
    return null;
  }

  if (!developmentId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">ID de projeto não encontrado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando CAD Studio...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-sm text-center">{error}</p>
        <Button variant="outline" onClick={() => navigate(`/parcelamento/${developmentId}`)}>
          Voltar ao Projeto
        </Button>
      </div>
    );
  }

  const canvasState = project?.canvas_state ?? { elements: [], layers: [] };
  const initialElements = canvasState.elements ?? [];
  const initialLayers = canvasState.layers?.length > 0 ? canvasState.layers : DEFAULT_LAYERS;
  const initialSettings = project?.settings ?? DEFAULT_SETTINGS;
  const initialViewport = getInitialViewport();
  const devGeometry = getDevelopmentGeometry();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {project && (
        <CADEditor
          developmentId={developmentId}
          projectId={project.id}
          projectName={project.name ?? "CAD Studio"}
          initialElements={initialElements}
          initialLayers={initialLayers}
          initialSettings={initialSettings}
          initialViewport={initialViewport}
          developmentGeometry={devGeometry}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
