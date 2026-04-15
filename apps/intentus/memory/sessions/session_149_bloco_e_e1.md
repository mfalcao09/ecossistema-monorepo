# Sessão 149 — Bloco E Fase E1: CAD Studio Nativo

**Data:** 2026-04-11  
**Commits:** `552fb36` (feat principal) + `9077537` (fix build uuid→crypto)  
**Vercel:** `dpl_EvG1J3owrjJReeTrMmDEqjVzgPZ6` — READY  
**Status:** ✅ FASE E1 COMPLETA

---

## Escopo Implementado

### DB (Supabase — execute_sql)
- `parcelamento_cad_projects`: id, tenant_id FK→tenants, development_id FK→developments, name, version INT DEFAULT 1, canvas_state JSONB, settings JSONB, created/updated_at, created_by FK→profiles, deleted_at
- `parcelamento_cad_elements`: id, project_id FK→...CASCADE, tenant_id, element_type TEXT CHECK, label, quadra_id self-FK, coordinates JSONB, properties JSONB, layer_name TEXT, style JSONB, fabric_object_id TEXT, sort_order INT
- 5 indexes + `extensions.moddatetime()` triggers + RLS `auth_tenant_id()` em ambas tabelas

### Edge Function: `cad-project-manager v1`
- 8 actions: create_project, get_project, list_projects, save_canvas, update_settings, update_name, delete_project, save_elements
- Auth via supabaseAdmin.auth.getUser(token) → user.app_metadata.tenant_id
- save_canvas auto-incrementa version | save_elements: delete-all + re-insert

### Tipos/Lib/Hook
- `src/types/cad.ts`: CADTool, CADElementCategory (10 tipos), CADElement, CADLayer, CADSettings, CADCanvasState, CATEGORY_STYLES, DEFAULT_LAYERS (6), DEFAULT_SETTINGS
- `src/lib/geoTransform.ts`: haversineM, computeAreaM2, computePerimeterM, findSnapVertex, formatArea/Length, buildSvgPath
- `src/hooks/useCadProject.ts`: invokeCAD wrapper, loadOrCreate, saveCanvas, updateSettings, renameProject

### Componentes (rota própria `/parcelamento/:id/cad`)
- CADEditor.tsx (805 linhas): dual-layer Mapbox+Fabric.js, snap-to-vertex 12px, undo/redo 50 níveis, atalhos V/L/P/T/Del/Esc/Ctrl+Z/Y/S
- CADToolbar.tsx, LayerManager.tsx, CADSidePanel.tsx (Lei 6.766 compliance em tempo real)
- ParcelamentoCAD.tsx: página principal
- App.tsx: + Route `/parcelamento/:id/cad`
- ParcelamentoDetalhe.tsx: + botão "CAD Studio"

## Decisão: uuid → crypto.randomUUID()
`uuid` package não instalado. Build Vercel falhou com "Rollup failed to resolve import uuid".
Fix: substituído por `crypto.randomUUID()` nativo (commit 9077537).
Lição: não usar `uuid` neste projeto — usar `crypto.randomUUID()` sempre.

## Próximo: Bloco E Fase E2 (ferramentas avançadas)
