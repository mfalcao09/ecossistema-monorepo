# Fase 1 — Plano de Execução (revisado pós-decisões D1–D5)

> **Data:** 07/04/2026
> **Status:** Plano consolidado, pronto para execução assim que Marcelo confirmar D2 e enviar a chave OpenTopography.
> **Pair programming:** Obrigatório com Buchecha (MiniMax M2.7) — diretiva CLAUDE.md #3.

---

## Visão geral

A Fase 1 entrega o **schema completo** do módulo Parcelamento de Solo unificado em `developments`, com suporte ao fluxo de 4 passos do Lovable (Upload → Análise Geo → Análise Financeira/Legal → Relatório).

Aplicação em **branch da Supabase** primeiro, validação via `get_advisors`, depois merge para main.

---

## 1.1 — Estender enum `development_type`

```sql
ALTER TYPE development_type ADD VALUE IF NOT EXISTS 'condominio';
ALTER TYPE development_type ADD VALUE IF NOT EXISTS 'misto';
```

**Por quê:** Loteamento e condomínio de lotes são juridicamente diferentes (Lei 6.766/79 vs CC art. 1.358-A) — área pública é desafetada num, condominial no outro. `misto` cobre empreendimentos verticais+horizontais combinados (Splendori, por exemplo, pode evoluir para isso).

## 1.2 — Estender `developments` com colunas geoespaciais

```sql
-- Habilitar PostGIS se ainda não estiver
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE developments
  ADD COLUMN IF NOT EXISTS geometry geography(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS centroid geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS bbox jsonb,
  ADD COLUMN IF NOT EXISTS area_m2 numeric(14,2),
  ADD COLUMN IF NOT EXISTS area_ha numeric(10,4),
  ADD COLUMN IF NOT EXISTS perimeter_m numeric(12,2),
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS source_file_format text CHECK (source_file_format IN ('kml','kmz','dxf','geojson','shp','manual')),
  ADD COLUMN IF NOT EXISTS elevation_grid jsonb,
  ADD COLUMN IF NOT EXISTS elevation_source text,
  ADD COLUMN IF NOT EXISTS elevation_min numeric(8,2),
  ADD COLUMN IF NOT EXISTS elevation_max numeric(8,2),
  ADD COLUMN IF NOT EXISTS elevation_avg numeric(8,2),
  ADD COLUMN IF NOT EXISTS slope_avg_pct numeric(6,2),
  ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending'
    CHECK (analysis_status IN ('pending','geo_analyzing','geo_done','financial_done','legal_done','complete','error')),
  ADD COLUMN IF NOT EXISTS analysis_results jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS app_area_m2 numeric(14,2),
  ADD COLUMN IF NOT EXISTS reserva_legal_area_m2 numeric(14,2),
  ADD COLUMN IF NOT EXISTS reserva_legal_pct numeric(5,2);

CREATE INDEX IF NOT EXISTS idx_developments_geometry ON developments USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_developments_centroid ON developments USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_developments_tenant_tipo ON developments (tenant_id, tipo);
CREATE INDEX IF NOT EXISTS idx_developments_analysis_results_gin ON developments USING GIN (analysis_results);
```

**Notas:**
- Uso `geography` (não `geometry`) para que cálculos de área venham em metros direto, sem reprojeção
- `analysis_results jsonb` é o "balde" flexível onde cada análise (geo, financial, legal) escreve seu output estruturado
- GIN index permite query por subcampo do JSONB

## 1.3 — Tabelas-filhas `development_parcelamento_*`

### `development_parcelamento_files`
Arquivos enviados (KML, KMZ, DXF, fotos do drone, plantas do projeto, etc.)

```sql
CREATE TABLE development_parcelamento_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('terrain','drone_photo','project_plan','document','other')),
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'parcelamento-files',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dpf_dev ON development_parcelamento_files(development_id);
CREATE INDEX idx_dpf_tenant ON development_parcelamento_files(tenant_id);
```

### `development_parcelamento_geo_layers`
Cache das camadas IBAMA/SICAR/DataGeo retornadas para o terreno (evita refetch)

```sql
CREATE TABLE development_parcelamento_geo_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  layer_key text NOT NULL,  -- 'sigef_privado','hidrografia','sicar_rl', etc.
  geojson jsonb NOT NULL,
  feature_count integer DEFAULT 0,
  source text NOT NULL,  -- 'pamgia_ibama','sicar','datageo_sp','manual'
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  UNIQUE (development_id, layer_key)
);

CREATE INDEX idx_dpgl_dev ON development_parcelamento_geo_layers(development_id);
CREATE INDEX idx_dpgl_expires ON development_parcelamento_geo_layers(expires_at);
```

### `development_parcelamento_financial`
Análise financeira (1 por empreendimento, com versionamento)

```sql
CREATE TABLE development_parcelamento_financial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  vgv_total numeric(14,2),
  custo_obra_total numeric(14,2),
  custo_terreno numeric(14,2),
  custo_legalizacao numeric(14,2),
  custo_marketing numeric(14,2),
  custo_comissoes numeric(14,2),
  cub_referencia numeric(10,2),
  prazo_obra_meses integer,
  fluxo_caixa jsonb,  -- array [{mes, entrada, saida, saldo}]
  payback_meses integer,
  tir_anual numeric(6,3),
  vpl numeric(14,2),
  margem_liquida_pct numeric(6,2),
  premissas jsonb,  -- {taxa_desconto, indice_correcao, ...}
  ai_summary text,  -- gerado por AI
  ai_summary_model text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE INDEX idx_dpfin_dev ON development_parcelamento_financial(development_id);
CREATE UNIQUE INDEX idx_dpfin_dev_version ON development_parcelamento_financial(development_id, version) WHERE is_active = true;
```

### `development_parcelamento_compliance`
Checklist de conformidade legal (Lei 6.766/79 + Código Florestal)

```sql
CREATE TABLE development_parcelamento_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  check_key text NOT NULL,  -- 'app_minima','rl_minima','sistema_viario','lote_minimo', etc.
  check_label text NOT NULL,
  legal_basis text,  -- 'Lei 6.766/79 art. 4º'
  required_value text,
  actual_value text,
  status text NOT NULL CHECK (status IN ('pass','warn','fail','na','pending')),
  ai_explanation text,
  ai_explanation_model text,
  metadata jsonb DEFAULT '{}'::jsonb,
  evaluated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE (development_id, check_key)
);

CREATE INDEX idx_dpcomp_dev ON development_parcelamento_compliance(development_id);
CREATE INDEX idx_dpcomp_status ON development_parcelamento_compliance(status);
```

### `development_parcelamento_reports`
Relatórios PDF gerados (parecer, memorial, ART placeholder)

```sql
CREATE TABLE development_parcelamento_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('parecer_tecnico','memorial_descritivo','tabela_areas','financial_summary','compliance_report','full')),
  title text NOT NULL,
  pdf_url text,
  pdf_size bigint,
  generated_by uuid NOT NULL,
  ai_generated boolean DEFAULT false,
  ai_model text,
  generation_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE INDEX idx_dprep_dev ON development_parcelamento_reports(development_id);
```

### `development_parcelamento_rl_cache` (cache global, sem tenant)
Cache da API DataGeo/SICAR para Reserva Legal — compartilhado entre todos os tenants

```sql
CREATE TABLE development_parcelamento_rl_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bbox_key text NOT NULL UNIQUE,  -- hash do bbox normalizado
  bbox jsonb NOT NULL,
  source text NOT NULL,  -- 'sicar' ou 'datageo_sp'
  features jsonb NOT NULL,
  feature_count integer DEFAULT 0,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_dprlc_expires ON development_parcelamento_rl_cache(expires_at);
```

## 1.4 — RLS Policies (PERMISSIVE primeiro, conforme regra Intentus)

Para cada tabela criada, vou aplicar o template padrão:

```sql
ALTER TABLE development_parcelamento_files ENABLE ROW LEVEL SECURITY;

-- PERMISSIVE: tenant pode ver seus próprios arquivos
CREATE POLICY "tenant_select_own"
ON development_parcelamento_files FOR SELECT
USING (tenant_id = (SELECT public.get_auth_tenant_id()));

CREATE POLICY "tenant_insert_own"
ON development_parcelamento_files FOR INSERT
WITH CHECK (tenant_id = (SELECT public.get_auth_tenant_id()) AND uploaded_by = auth.uid());

CREATE POLICY "tenant_update_own"
ON development_parcelamento_files FOR UPDATE
USING (tenant_id = (SELECT public.get_auth_tenant_id()));

CREATE POLICY "tenant_delete_own"
ON development_parcelamento_files FOR DELETE
USING (tenant_id = (SELECT public.get_auth_tenant_id()));

-- Repete o template para as outras 4 tabelas com tenant_id
-- A tabela rl_cache (sem tenant) tem RLS aberta para SELECT autenticado
```

## 1.5 — Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('parcelamento-files', 'parcelamento-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "tenant_upload_own"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'parcelamento-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "tenant_read_own"
ON storage.objects FOR SELECT
USING (bucket_id = 'parcelamento-files' AND auth.uid() IS NOT NULL);
-- Restrição por tenant fica na URL signed do frontend
```

## 1.6 — Triggers de updated_at

```sql
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_dpf BEFORE UPDATE ON development_parcelamento_files
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
-- Repetir para as outras tabelas
```

## 1.7 — Permissões CLM/RBAC

Adicionar entries em `allowed_transitions` para o módulo:

```sql
INSERT INTO allowed_transitions (tenant_id, entity_type, from_status, to_status, allowed_role)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'development_parcelamento', 'pending', 'geo_analyzing', 'corretor'),
  ('00000000-0000-0000-0000-000000000000', 'development_parcelamento', 'geo_analyzing', 'geo_done', 'corretor'),
  ('00000000-0000-0000-0000-000000000000', 'development_parcelamento', 'geo_done', 'financial_done', 'gerente'),
  ('00000000-0000-0000-0000-000000000000', 'development_parcelamento', 'financial_done', 'legal_done', 'juridico'),
  ('00000000-0000-0000-0000-000000000000', 'development_parcelamento', 'legal_done', 'complete', 'gerente');
```

(`tenant_id zerado` = template global aplicado a todos os tenants — padrão Intentus existente)

## 1.8 — Validação pós-deploy

1. `mcp__supabase__get_advisors` (security + performance) → corrigir todos os WARNINGS críticos
2. `mcp__supabase__list_migrations` → confirmar migration registrada
3. SELECT em `developments` num tenant de teste (Marcelo) → confirmar que colunas novas existem e são nullable
4. INSERT de teste em cada tabela-filha → validar RLS

## 1.9 — Code review com Buchecha

Antes de commit:
1. Skill `minimax-ai-assistant:review-minimax` → revisão completa do SQL
2. Se houver gotchas, ajustar
3. Aprovação Buchecha → commit

## 1.10 — Conventional commit

```
feat(parcelamento): schema do módulo Parcelamento de Solo (Fase 1)

- Estende enum development_type com 'condominio' e 'misto'
- Adiciona colunas geoespaciais a developments (PostGIS geography)
- Cria 6 tabelas development_parcelamento_* com RLS PERMISSIVE
- Cria storage bucket parcelamento-files
- Adiciona triggers de updated_at e permissões RBAC

Decisão D1: Opção B (unificado com developments) — descoberta de
que enum development_type já existia com loteamento/vertical.

Refs: memory/projects/parcelamento-solo-DECISOES-D1-D5.md

Co-Authored-By: Buchecha (MiniMax M2.7) <noreply@minimax.ai>
Co-Authored-By: Claudinho (Claude Opus 4.6) <noreply@anthropic.com>
```

---

## Fora do escopo desta Fase 1

(documentado para não esquecer nas próximas fases)

- **Fase 2:** Migração das 5 EFs para `development-*` + ajustes CORS/auth
- **Fase 3:** Frontend — rota `/parcelamento`, fluxo 4-passos, mapa Leaflet+3D, lista de empreendimentos
- **Fase 4:** Análise Financeira (módulo D4)
- **Fase 5:** Conformidade Legal (módulo D4)
- **Fase 6:** Relatórios PDF + IA generativa (módulos D4 + D5)
- **Fase 7:** Integração com CRM (lead → proposta → empreendimento)
- **Fase 8:** Integração com CLM (empreendimento → contratos de venda)

---

## Riscos identificados

| Risco | Severidade | Mitigação |
|---|---|---|
| `developments` em produção tem dados — ALTER TABLE pode bloquear | 🟡 Média | Todas as colunas novas são `NULL`-able, sem default pesado. ALTER TABLE será rápido. |
| PostGIS pode não estar habilitado no projeto | 🟢 Baixa | `CREATE EXTENSION IF NOT EXISTS postgis` no início da migration |
| Enum value adicionado a `development_type` exige commit antes de uso em DEFAULT | 🟢 Baixa | Não estamos mudando o default — só adicionando opções |
| RLS PERMISSIVE sem nenhum SELECT por tenant pode bloquear queries existentes | 🟡 Média | Migration **só estende** — não altera RLS de `developments` |

---

## Checklist GO/NO-GO antes de executar

- [x] D1 confirmada (Opção B)
- [x] D2 confirmada — **ConvertAPI** (Opção 3 da matriz)
- [x] D3 confirmada (cadastrar OpenTopography)
- [x] D4 confirmada (incluir 3 placeholders)
- [x] D5 confirmada (IA-native desde a v0.1)
- [x] **Chave OpenTopography recebida** — `OPENTOPO_API_KEY=eefa7c0b13e68acf907f50288b685522` (configurar como secret antes do deploy da EF de elevação na Fase 2)
- [x] **GO explícito recebido de Marcelo** — "Pode rodar a migration na branch da supabase" (07/04/2026)

---

## Histórico

- **07/04/2026** — Plano criado pós-decisões D1, D3, D4, D5. Aguardando D2 e GO de Marcelo.
- **07/04/2026 (continuação)** — D2 = ConvertAPI confirmada. Chave OpenTopography recebida. GO dado. Iniciando execução: criar branch Supabase → review com Buchecha → apply migration → advisors.
