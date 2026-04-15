import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CADProjectData, CADCanvasState, CADSettings } from "@/types/cad";

async function invokeCAD<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cad-project-manager", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data?.data as T;
}

export function useCadProject() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<CADProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load or create project for a development
  const loadOrCreate = useCallback(async (developmentId: string, userId?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Try to load existing
      let proj = await invokeCAD<CADProjectData | null>("get_project", {
        development_id: developmentId,
      });

      if (!proj) {
        // Create new
        proj = await invokeCAD<CADProjectData>("create_project", {
          development_id: developmentId,
          name: "Projeto CAD",
          created_by: userId,
        });
      }

      // Ensure canvas_state has elements and layers
      if (!proj.canvas_state?.elements) {
        proj.canvas_state = { elements: [], layers: [] };
      }

      setProject(proj);
      return proj;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar projeto";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save canvas state
  const saveCanvas = useCallback(
    async (projectId: string, canvasState: CADCanvasState) => {
      setSaving(true);
      try {
        const updated = await invokeCAD<CADProjectData>("save_canvas", {
          project_id: projectId,
          canvas_state: canvasState,
        });
        setProject(updated);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar";
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // Update settings
  const updateSettings = useCallback(
    async (projectId: string, settings: CADSettings) => {
      try {
        const updated = await invokeCAD<CADProjectData>("update_settings", {
          project_id: projectId,
          settings,
        });
        setProject(updated);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao atualizar settings";
        setError(msg);
      }
    },
    []
  );

  // Rename project
  const renameProject = useCallback(async (projectId: string, name: string) => {
    try {
      const updated = await invokeCAD<CADProjectData>("update_name", {
        project_id: projectId,
        name,
      });
      setProject(updated);
    } catch {
      // silently fail rename
    }
  }, []);

  return {
    project,
    loading,
    saving,
    error,
    loadOrCreate,
    saveCanvas,
    updateSettings,
    renameProject,
  };
}
