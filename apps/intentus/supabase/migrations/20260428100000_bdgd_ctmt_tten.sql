-- ============================================================================
-- BDGD — CTMT (Circuito Média Tensão) + TTEN (Tipo de Tensão)
-- ============================================================================
-- Sessão 155 (2026-04-28) — P-193
--
-- Manual BDGD Rev 3 (Anexo I §3.4) define CTMT como entidade NÃO-geográfica
-- com 58 fields, vinculada a SSDMT via FK `CTMT`. SSDMT em si NÃO tem coluna
-- de tensão — vem via JOIN: SSDMT.CTMT = CTMT.COD_ID, e CTMT.TEN_NOM é FK
-- pra TTEN (tabela de domínio com COD_ID → TEN em volts).
--
-- Schema:
--   bdgd_circuitos_mt   — uma linha por CTMT (~10k-50k por distribuidora)
--   bdgd_tipos_tensao   — domain estático TTEN (~110 codes do Anexo II §2.17)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) bdgd_tipos_tensao — domain TTEN (Anexo II §2.17 do Manual Rev 3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_tipos_tensao (
  cod_id      TEXT PRIMARY KEY,         -- ex: "49"
  tensao_v    NUMERIC NOT NULL,          -- ex: 13800 (volts)
  descricao   TEXT NOT NULL              -- ex: "13,8 kV"
);

COMMENT ON TABLE bdgd_tipos_tensao IS
  'Tabela de domínio TTEN (Anexo II §2.17 do Manual BDGD Rev 3). Conversão de codigo TEN_NOM (CTMT/CTAT/etc) → tensão em volts.';

-- Seed canônico do Manual Rev 3 (110 entries oficiais ANEEL)
-- BT (residencial/comercial)
INSERT INTO bdgd_tipos_tensao (cod_id, tensao_v, descricao) VALUES
  ('0','0','Não informado'),
  ('1','110','110 V'), ('2','115','115 V'), ('3','120','120 V'),
  ('4','121','121 V'), ('5','125','125 V'), ('6','127','127 V'),
  ('7','208','208 V'), ('8','216','216 V'), ('9','216.5','216,5 V'),
  ('10','220','220 V'), ('11','230','230 V'), ('12','231','231 V'),
  ('13','240','240 V'), ('14','254','254 V'), ('15','380','380 V'),
  ('16','400','400 V'), ('17','440','440 V'), ('18','480','480 V'),
  ('19','500','500 V'), ('20','600','600 V'), ('21','750','750 V'),
  ('22','1000','1 kV'),
  -- MT (distribuição local)
  ('23','2300','2,3 kV'), ('24','3200','3,2 kV'), ('25','3600','3,6 kV'),
  ('26','3785','3,785 kV'), ('27','3800','3,8 kV'), ('28','3848','3,848 kV'),
  ('29','3985','3,985 kV'), ('30','4160','4,16 kV'), ('31','4200','4,2 kV'),
  ('32','4207','4,207 kV'), ('33','4368','4,368 kV'), ('34','4560','4,56 kV'),
  ('35','5000','5 kV'), ('36','6000','6 kV'), ('37','6600','6,6 kV'),
  ('38','6930','6,93 kV'), ('39','7960','7,96 kV'), ('40','8670','8,67 kV'),
  ('103','11000','11 kV'), ('41','11400','11,4 kV'), ('104','11500','11,5 kV'),
  ('42','11900','11,9 kV'), ('43','12000','12 kV'), ('44','12600','12,6 kV'),
  ('45','12700','12,7 kV'), ('105','13000','13 kV'), ('46','13200','13,2 kV'),
  ('47','13337','13,337 kV'), ('48','13530','13,53 kV'), ('49','13800','13,8 kV'),
  ('50','13860','13,86 kV'), ('51','14140','14,14 kV'), ('52','14190','14,19 kV'),
  ('53','14400','14,4 kV'), ('54','14835','14,835 kV'), ('55','15000','15 kV'),
  ('56','15200','15,2 kV'), ('57','19053','19,053 kV'), ('58','19919','19,919 kV'),
  ('106','20000','20 kV'), ('59','21000','21 kV'), ('60','21500','21,5 kV'),
  ('61','22000','22 kV'), ('62','23000','23 kV'), ('63','23100','23,1 kV'),
  ('64','23827','23,827 kV'), ('65','24000','24 kV'), ('66','24200','24,2 kV'),
  ('67','25000','25 kV'), ('68','25800','25,8 kV'), ('69','27000','27 kV'),
  ('70','30000','30 kV'), ('71','33000','33 kV'), ('72','34500','34,5 kV'),
  ('73','36000','36 kV'),
  -- AT (subtransmissão)
  ('74','38000','38 kV'), ('75','40000','40 kV'), ('76','44000','44 kV'),
  ('77','45000','45 kV'), ('78','45400','45,4 kV'), ('79','48000','48 kV'),
  ('80','60000','60 kV'), ('81','66000','66 kV'), ('107','68000','68 kV'),
  ('82','69000','69 kV'), ('83','72500','72,5 kV'), ('108','85000','85 kV'),
  ('84','88000','88 kV'), ('85','88200','88,2 kV'), ('86','92000','92 kV'),
  ('87','100000','100 kV'), ('88','120000','120 kV')
ON CONFLICT (cod_id) DO UPDATE SET
  tensao_v = EXCLUDED.tensao_v,
  descricao = EXCLUDED.descricao;

-- ----------------------------------------------------------------------------
-- 2) bdgd_circuitos_mt — CTMT (não-geográfica, vincula SSDMT.CTMT → COD_ID)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_circuitos_mt (
  id                BIGSERIAL PRIMARY KEY,
  distribuidora_id  SMALLINT NOT NULL REFERENCES bdgd_distribuidoras(id) ON DELETE CASCADE,
  cod_id            TEXT NOT NULL,                -- CTMT.COD_ID, único por distribuidora
  nome              TEXT,                          -- nome do alimentador (humano)
  ten_nom_cod       TEXT REFERENCES bdgd_tipos_tensao(cod_id),  -- TEN_NOM → TTEN
  ten_ope_pu        NUMERIC,                       -- tensão de operação em p.u.
  sub_cod_id        TEXT,                          -- código subestação que alimenta
  energia_anual_kwh NUMERIC,                       -- soma ENE_01..ENE_12 (P-195)
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (distribuidora_id, cod_id)
);

CREATE INDEX IF NOT EXISTS bdgd_circuitos_mt_cod_id_idx
  ON bdgd_circuitos_mt (distribuidora_id, cod_id);

COMMENT ON TABLE bdgd_circuitos_mt IS
  'Circuitos MT (alimentadores) BDGD V11 Anexo I §3.4. Vincula a SSDMT via cod_id; resolve tensão real via JOIN com bdgd_tipos_tensao.';
COMMENT ON COLUMN bdgd_circuitos_mt.energia_anual_kwh IS
  'Soma das colunas ENE_01..ENE_12 do CTMT (consumo anual em kWh). Pra P-195 (capacidade alimentador).';

-- ----------------------------------------------------------------------------
-- 3) RPC atualizada — JOIN com CTMT + TTEN para tensão real
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bdgd_proximity_for_development(
  p_development_id UUID,
  p_buffer_km      NUMERIC DEFAULT 10
)
RETURNS TABLE (
  layer            TEXT,
  source_tier      TEXT,
  distribuidora    TEXT,
  cod_aneel        TEXT,
  cod_id           TEXT,
  tensao           TEXT,
  ctmt_nome        TEXT,        -- novo: nome do alimentador (humano)
  ctmt_cod_id      TEXT,        -- novo: código do alimentador
  fases            TEXT,
  comprimento_buffer_m NUMERIC,
  geom_geojson     JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_has_hd BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM bdgd_segments_hd WHERE development_id = p_development_id LIMIT 1
  ) INTO v_has_hd;

  IF v_has_hd THEN
    RETURN QUERY
    WITH dev AS (
      SELECT geometry::geography AS geom FROM developments WHERE id = p_development_id
    ),
    buf AS (SELECT ST_Buffer(geom, p_buffer_km * 1000) AS geom FROM dev)
    SELECT
      hd.tipo::TEXT,
      't2'::TEXT,
      d.nome,
      d.cod_aneel,
      hd.cod_id,
      CASE
        WHEN hd.tipo = 'mt'  THEN COALESCE(hd.tensao_kv::TEXT,'') || ' kV'
        WHEN hd.tipo = 'bt'  THEN COALESCE(hd.tensao_v::TEXT,'')  || ' V'
        WHEN hd.tipo = 'sub' THEN COALESCE(hd.tensao_kv::TEXT,'') || ' kV'
      END,
      NULL::TEXT,                                    -- ctmt_nome (Tier 2 ainda sem JOIN)
      NULL::TEXT,                                    -- ctmt_cod_id
      hd.fases,
      CASE WHEN hd.tipo IN ('mt','bt')
        THEN ST_Length(ST_Intersection(hd.geom, buf.geom))::NUMERIC
        ELSE NULL
      END,
      CASE WHEN hd.tipo = 'sub'
        THEN ST_AsGeoJSON(hd.geom)::JSONB
        ELSE ST_AsGeoJSON(ST_Intersection(hd.geom, buf.geom))::JSONB
      END
    FROM bdgd_segments_hd hd
      JOIN bdgd_distribuidoras d ON d.id = hd.distribuidora_id
      CROSS JOIN buf
    WHERE hd.development_id = p_development_id
      AND ST_DWithin(hd.geom, (SELECT geom FROM dev), p_buffer_km * 1000);
  ELSE
    -- Tier 1 com JOIN CTMT + TTEN para tensão REAL (P-193)
    RETURN QUERY
    WITH dev AS (
      SELECT geometry::geography AS geom FROM developments WHERE id = p_development_id
    ),
    buf AS (SELECT ST_Buffer(geom, p_buffer_km * 1000) AS geom FROM dev)
    -- MT (com tensão via CTMT JOIN TTEN, fallback s.tensao_kv legacy)
    SELECT
      'mt'::TEXT, 't1'::TEXT, d.nome, d.cod_aneel, s.cod_id,
      COALESCE(
        (tt.tensao_v / 1000)::NUMERIC(10,2)::TEXT || ' kV',
        s.tensao_kv::TEXT || ' kV'
      ),
      c.nome,                                        -- ctmt_nome (alimentador)
      c.cod_id,                                      -- ctmt_cod_id
      s.fases,
      ST_Length(ST_Intersection(s.geom, buf.geom))::NUMERIC,
      ST_AsGeoJSON(ST_Intersection(s.geom, buf.geom))::JSONB
    FROM bdgd_mt_segments s
      JOIN bdgd_distribuidoras d ON d.id = s.distribuidora_id
      LEFT JOIN bdgd_circuitos_mt c
        ON c.distribuidora_id = s.distribuidora_id AND c.cod_id = s.ctmt
      LEFT JOIN bdgd_tipos_tensao tt ON tt.cod_id = c.ten_nom_cod
      CROSS JOIN buf
    WHERE ST_DWithin(s.geom, (SELECT geom FROM dev), p_buffer_km * 1000)
    UNION ALL
    -- BT (sem CTMT join — tensão V vem via segment próprio quando popula, ou NULL)
    SELECT 'bt'::TEXT, 't1'::TEXT, d.nome, d.cod_aneel, s.cod_id,
      COALESCE(s.tensao_v::TEXT || ' V', '—'),
      NULL::TEXT, NULL::TEXT,
      s.fases,
      ST_Length(ST_Intersection(s.geom, buf.geom))::NUMERIC,
      ST_AsGeoJSON(ST_Intersection(s.geom, buf.geom))::JSONB
    FROM bdgd_bt_segments s
      JOIN bdgd_distribuidoras d ON d.id = s.distribuidora_id
      CROSS JOIN buf
    WHERE ST_DWithin(s.geom, (SELECT geom FROM dev), p_buffer_km * 1000)
    UNION ALL
    -- SUB
    SELECT 'sub'::TEXT, 't1'::TEXT, d.nome, d.cod_aneel, s.cod_id,
      COALESCE(s.tensao_pri_kv::TEXT || '/' || s.tensao_sec_kv::TEXT || ' kV', '—'),
      NULL::TEXT, NULL::TEXT,
      NULL, NULL,
      ST_AsGeoJSON(s.geom)::JSONB
    FROM bdgd_substations s
      JOIN bdgd_distribuidoras d ON d.id = s.distribuidora_id
    WHERE ST_DWithin(s.geom, (SELECT geom FROM dev), p_buffer_km * 1000);
  END IF;
END;
$$;

-- Permite a frontend authenticated chamar a RPC
GRANT EXECUTE ON FUNCTION bdgd_proximity_for_development(UUID, NUMERIC) TO authenticated, anon;
GRANT SELECT ON bdgd_circuitos_mt TO authenticated, anon;
GRANT SELECT ON bdgd_tipos_tensao TO authenticated, anon;

-- RLS minimalista — dados públicos da ANEEL, leitura pública
ALTER TABLE bdgd_circuitos_mt ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdgd_tipos_tensao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BDGD circuitos MT readable by all" ON bdgd_circuitos_mt;
CREATE POLICY "BDGD circuitos MT readable by all"
  ON bdgd_circuitos_mt FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "BDGD tipos tensao readable by all" ON bdgd_tipos_tensao;
CREATE POLICY "BDGD tipos tensao readable by all"
  ON bdgd_tipos_tensao FOR SELECT
  USING (true);
