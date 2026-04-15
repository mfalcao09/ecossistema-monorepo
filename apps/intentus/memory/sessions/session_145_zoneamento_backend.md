# Sessão 145 — Bloco H Sprint 5: US-125 Zoneamento Municipal (Backend Files)

**Date**: 2026-04-11  
**Session**: 145  
**Project**: Intentus Real Estate Platform  
**US**: US-125 Detector de Zoneamento Municipal  
**Pair**: Claudinho + Buchecha (MiniMax M2.7)  
**Status**: ✅ Backend files created (3/3)

## Summary

Created 3 complete TypeScript files for US-125 (Zoneamento Municipal detector). This is the Edge Function + types + hooks foundation for extracting municipal zoning parameters from Plano Diretor PDFs using Gemini 2.0 Flash multimodal AI.

## Files Created

### 1. Edge Function: `supabase/functions/zoneamento-municipal/index.ts`
**Lines**: ~400  
**Size**: 15K  

**ACTIONS** (4 total):

1. **`analyze_pdf`** — Main action
   - Input: `development_id`, `pdf_base64` OR `pdf_url`, `municipality`, `state`
   - Process: Sends PDF to Gemini 2.0 Flash multimodal with structured extraction prompt
   - Output: JSON with all zoning parameters
   - Extracts:
     - **CA (Coeficiente de Aproveitamento)**: basic, max, min
     - **TO (Taxa de Ocupação)**: percentage 0-100
     - **Gabarito**: floors count + height in meters
     - **Recuos (Setbacks)**: frontal, lateral, fundos (in meters)
     - **Zona**: zoning classification name
     - **Permeabilidade**: percentage 0-100
     - **Usos Permitidos/Proibidos**: lists of allowed/forbidden uses
     - **Confidence Score**: 0-100 from Gemini
   - Saves to `development_zoneamento_municipal` table (upsert by development_id)

2. **`analyze_manual`** — Validation action
   - Input: All fields manually typed (development_id + zoneamento params)
   - Process: Validates and normalizes data
   - Output: Saves to DB with confidence_score = 100 (manual = high confidence)

3. **`get_zoning`** — Fetch cached data
   - Input: `development_id`
   - Output: Latest zoneamento record or 404

4. **`list_zonings`** — Browse history
   - Input: `development_id`, optional `limit`
   - Output: List of all analyses for development (paginated)

**Implementation Details**:
- CORS: Standard Intentus pattern (ALLOWED_ORIGINS_RAW, DEV_PATTERNS, PROD_ORIGINS, isOriginAllowed, corsHeaders)
- Auth: User auth via Supabase + service role for DB writes
- Database: Uses `.maybeSingle()` (never `.single()` — prevents crash on PGRST116)
- Gemini API: 
  - Uses multimodal endpoint with `inlineData` mimeType `application/pdf`
  - Prompt requests JSON response via `responseMimeType: application/json`
  - Temperature 0.2 (low = deterministic extraction)
- Error handling: Returns `{ error: { code, message } }` shape, not exceptions
- Caching: DB upsert with `updated_at` timestamp for cache invalidation

### 2. Types: `src/lib/parcelamento/zoneamento-types.ts`
**Lines**: ~180  
**Size**: 7.1K  

**Exported Interfaces**:

- **AnalyzePdfParams**: (development_id, pdf_base64, pdf_url, municipality, state)
- **AnalyzePdfResult**: { data?: ZoneamentoRecord, error?: { code, message } }
- **AnalyzeManualParams**: (development_id, ca_basico, ca_maximo, ..., observacoes)
- **AnalyzeManualResult**: Same as AnalyzePdfResult
- **GetZoningParams**: (development_id)
- **GetZoningResult**: { data?: ZoneamentoRecord, error? }
- **ListZoningsParams**: (development_id, limit?)
- **ListZoningsResult**: { data?: { zonings: ZoneamentoSummary[], count }, error? }

**Data Model** (ZoneamentoRecord):
```ts
{
  id: string;
  development_id: string;
  ca_basico?: number;
  ca_maximo?: number;
  ca_minimo?: number;
  to_percentual?: number;
  gabarito_andares?: number;
  gabarito_altura_m?: number;
  recuo_frontal_m?: number;
  recuo_lateral_m?: number;
  recuo_fundos_m?: number;
  zona_classificacao?: string;
  permeabilidade_percentual?: number;
  usos_permitidos: string[];
  usos_proibidos: string[];
  observacoes?: string;
  confidence_score?: number;
  status: "generated" | "reviewed" | "approved" | "submitted";
  created_at: string;
  updated_at: string;
}
```

**Helper Constants**:
- `ZONEAMENTO_STATUS_LABELS`: PT-BR status translations
- `ZONEAMENTO_STATUS_COLORS`: Tailwind color mapping for UI badges
- `ZONING_CLASSIFICATIONS`: Array of common Brazilian zoning types (Residencial 1-3, Comercial, Industrial, Mista, etc.)
- `ZONING_USE_TYPES`: Object with categorized use types (residential, commercial, industrial, institutional, leisure)

**Helper Functions**:
- `getStatusLabel(status)`: Returns PT-BR label
- `getStatusColor(status)`: Returns Tailwind color
- `isValidZoneamento(data)`: Checks if at least one parameter provided
- `formatZoneamentoForDisplay(data)`: Human-readable summary object

### 3. Hooks: `src/hooks/useZoneamento.ts`
**Lines**: ~50  
**Size**: 2.9K  

**Exported Hooks** (all use `useMutation`):

1. **`useAnalyzeZoneamentoPdf()`**
   - Usage: `const { mutate, isPending, error } = useAnalyzeZoneamentoPdf(); mutate({ development_id, pdf_base64, municipality, state })`
   - Returns: AnalyzePdfResult

2. **`useAnalyzeZoneamentoManual()`**
   - Usage: `useAnalyzeZoneamentoManual().mutate({ development_id, ca_basico, ... })`
   - Returns: AnalyzeManualResult

3. **`useGetZoning()`**
   - Usage: `useGetZoning().mutate({ development_id })`
   - Returns: GetZoningResult

4. **`useListZonings()`**
   - Usage: `useListZonings().mutate({ development_id, limit: 10 })`
   - Returns: ListZoningsResult

**Generic Helper**:
- `callZoneamento<T>(body)`: Invokes `supabase.functions.invoke("zoneamento-municipal", { body })`
  - Throws error if EF call fails
  - Returns typed data via `as T`

**Pattern**: Follows `useMapBiomas.ts` exactly — each hook wraps a unique action with mutationFn + body: { action, params }

## Key Design Decisions

1. **Gemini 2.0 Flash over Gemini 1.5**: Faster, sufficient for structured extraction, lower cost
2. **PDF Base64 + URL support**: Flexible input — either upload base64 or pass public URL
3. **Confidence Score**: Allows UI to highlight low-confidence extractions for manual review
4. **Status field**: Enables workflow (generated → reviewed → approved → submitted to authorities)
5. **Observations field**: Captures edge cases and special zoning conditions
6. **Uses arrays**: `usos_permitidos` and `usos_proibidos` as lists for filtering/display
7. **Upsert logic**: Keeps only latest analysis per development_id (by design for MVP)
8. **No Copilot integration yet**: Backend ready for Copilot v22 tools in next phase

## Database Schema Required

Must create table (migration pending):
```sql
CREATE TABLE development_zoneamento_municipal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL UNIQUE REFERENCES developments(id),
  ca_basico numeric,
  ca_maximo numeric,
  ca_minimo numeric,
  to_percentual numeric,
  gabarito_andares integer,
  gabarito_altura_m numeric,
  recuo_frontal_m numeric,
  recuo_lateral_m numeric,
  recuo_fundos_m numeric,
  zona_classificacao text,
  permeabilidade_percentual numeric,
  usos_permitidos text[],
  usos_proibidos text[],
  observacoes text,
  confidence_score integer DEFAULT 0,
  status text DEFAULT 'generated',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

## Next Steps (Bloco H Sprint 5 Roadmap)

1. ✅ **US-125 Backend Files** (this session)
2. **US-125 Frontend Tab**: ParcelamentoZoneamento React component + ParcelamentDialog integration
3. **Copilot v22 Integration**: Add 2 tools to copilot EF
4. **US-130 Memorial Descritivo**: Move to Sprint 5 phase 2
5. **Deploy**: All 3 EFs to production, test end-to-end

## Testing Checklist (for next session UI)

- [ ] Fetch real Plano Diretor PDF, test analyze_pdf
- [ ] Verify Gemini extraction accuracy vs manual review
- [ ] Test manual entry validation
- [ ] Check confidence_score calculation
- [ ] Verify DB upsert behavior (duplicate development_id)
- [ ] Test list_zonings pagination
- [ ] CORS validation on production origin
- [ ] Error handling for missing API keys
- [ ] Gemini rate limits

## Commit Info

- **Files**: 3 new TypeScript files (backend only)
- **Lines of code**: ~630 (EF ~400, Types ~180, Hooks ~50)
- **Dependencies**: @supabase/supabase-js, @tanstack/react-query (existing)
- **New dependencies**: None
- **Secrets needed**: GOOGLE_API_KEY or GEMINI_API_KEY (to be set in Supabase)
- **Breaking changes**: None
- **Next commit**: Will include DB migration + UI components after deployment

---

**Session Duration**: Brief (file creation only)  
**Pair Status**: ✅ Claudinho + Buchecha synchronized  
**Memory**: Updated in `/mnt/.auto-memory/MEMORY.md`
