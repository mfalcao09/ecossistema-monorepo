/**
 * Fix RPC converter_sessao_em_processo — 4 bugs encontrados no teste e2e (sessão 058)
 *
 * Bug #1: naturalidade_uf recebe nome completo ("Mato Grosso do Sul") em vez de sigla ("MS")
 *         → Adicionamos helper normalizar_uf() que converte nome completo → sigla
 * Bug #2: rg_orgao_expedidor não lê campo "rg_orgao" do FormularioRevisao
 *         → COALESCE agora inclui v_aluno->>'rg_orgao'
 * Bug #3: ENADE sem campo "situacao" — dados têm "habilitado" em vez de "situacao"
 *         → Derivamos situacao a partir de habilitado/condicao
 * Bug #4: check constraint não inclui 'aguardando_revisao' e 'convertido_em_processo'
 *         → Adicionamos os dois valores
 */

-- ════════════════════════════════════════════════════════════════════
-- Helper: normalizar UF (nome completo → sigla de 2 caracteres)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.normalizar_uf(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean TEXT;
BEGIN
  IF p_input IS NULL OR TRIM(p_input) = '' THEN
    RETURN NULL;
  END IF;

  v_clean := UPPER(TRIM(p_input));

  -- Já é sigla de 2 caracteres?
  IF LENGTH(v_clean) = 2 THEN
    RETURN v_clean;
  END IF;

  -- Mapeamento nome completo → sigla
  RETURN CASE v_clean
    WHEN 'ACRE' THEN 'AC'
    WHEN 'ALAGOAS' THEN 'AL'
    WHEN 'AMAPA' THEN 'AP'
    WHEN 'AMAPÁ' THEN 'AP'
    WHEN 'AMAZONAS' THEN 'AM'
    WHEN 'BAHIA' THEN 'BA'
    WHEN 'CEARA' THEN 'CE'
    WHEN 'CEARÁ' THEN 'CE'
    WHEN 'DISTRITO FEDERAL' THEN 'DF'
    WHEN 'ESPIRITO SANTO' THEN 'ES'
    WHEN 'ESPÍRITO SANTO' THEN 'ES'
    WHEN 'GOIAS' THEN 'GO'
    WHEN 'GOIÁS' THEN 'GO'
    WHEN 'MARANHAO' THEN 'MA'
    WHEN 'MARANHÃO' THEN 'MA'
    WHEN 'MATO GROSSO' THEN 'MT'
    WHEN 'MATO GROSSO DO SUL' THEN 'MS'
    WHEN 'MINAS GERAIS' THEN 'MG'
    WHEN 'PARA' THEN 'PA'
    WHEN 'PARÁ' THEN 'PA'
    WHEN 'PARAIBA' THEN 'PB'
    WHEN 'PARAÍBA' THEN 'PB'
    WHEN 'PARANA' THEN 'PR'
    WHEN 'PARANÁ' THEN 'PR'
    WHEN 'PERNAMBUCO' THEN 'PE'
    WHEN 'PIAUI' THEN 'PI'
    WHEN 'PIAUÍ' THEN 'PI'
    WHEN 'RIO DE JANEIRO' THEN 'RJ'
    WHEN 'RIO GRANDE DO NORTE' THEN 'RN'
    WHEN 'RIO GRANDE DO SUL' THEN 'RS'
    WHEN 'RONDONIA' THEN 'RO'
    WHEN 'RONDÔNIA' THEN 'RO'
    WHEN 'RORAIMA' THEN 'RR'
    WHEN 'SANTA CATARINA' THEN 'SC'
    WHEN 'SAO PAULO' THEN 'SP'
    WHEN 'SÃO PAULO' THEN 'SP'
    WHEN 'SERGIPE' THEN 'SE'
    WHEN 'TOCANTINS' THEN 'TO'
    ELSE LEFT(v_clean, 2) -- fallback: primeiras 2 letras (melhor que erro)
  END;
END;
$$;

COMMENT ON FUNCTION public.normalizar_uf IS
  'Converte nome completo de UF para sigla de 2 caracteres. Sessão 058.';

-- ════════════════════════════════════════════════════════════════════
-- Bug #4: Adicionar status faltantes no check constraint
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE extracao_sessoes DROP CONSTRAINT IF EXISTS extracao_sessoes_status_check;
ALTER TABLE extracao_sessoes ADD CONSTRAINT extracao_sessoes_status_check
  CHECK (status = ANY (ARRAY[
    'pendente', 'processando', 'concluido', 'erro',
    'aprovado', 'rejeitado', 'rascunho', 'descartado',
    'aguardando_revisao', 'convertido_em_processo'
  ]));

-- ════════════════════════════════════════════════════════════════════
-- RPC v2: corrige bugs #1, #2, #3
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.converter_sessao_em_processo(
  p_sessao_id    UUID,
  p_override_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sessao           RECORD;
  v_dados            JSONB;
  v_aluno            JSONB;
  v_academicos       JSONB;
  v_disciplinas      JSONB;
  v_atividades       JSONB;
  v_estagios         JSONB;
  v_habilitacoes     JSONB;
  v_genitores        JSONB;
  v_enade            JSONB;
  v_curso_id         UUID;
  v_processo_id      UUID;
  v_diplomado_id     UUID;
  v_diploma_id       UUID;
  v_diplomado_novo   BOOLEAN := FALSE;
  v_cpf_limpo        TEXT;
  v_nome_aluno       TEXT;
  v_nome_processo    TEXT;
  v_sexo_db          TEXT;
  v_sexo_raw         TEXT;
  v_sit_raw          TEXT;
  v_sit_enum         TEXT;
  v_arquivos_count   INT := 0;
  v_disc             JSONB;
  v_idx              INT;
  v_ativ             JSONB;
  v_est              JSONB;
  v_hab              JSONB;
  v_gen              JSONB;
  -- Variáveis para naturalidade normalizada
  v_nat_uf_raw       TEXT;
  v_nat_uf           TEXT;
  v_rg_uf_raw        TEXT;
  v_rg_uf            TEXT;
  -- ENADE derivado
  v_enade_situacao   TEXT;
  v_enade_ano        INT;
BEGIN
  -- ══════════════════════════════════════════════════════════════════
  -- 1) Buscar sessão com lock (evita conversão dupla concorrente)
  -- ══════════════════════════════════════════════════════════════════
  SELECT id, usuario_id, status, processo_id,
         dados_confirmados, dados_extraidos
    INTO v_sessao
    FROM extracao_sessoes
   WHERE id = p_sessao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSAO_NAO_ENCONTRADA: Sessão % não existe', p_sessao_id;
  END IF;

  -- Idempotência: já convertida → retorna o processo_id existente
  IF v_sessao.status = 'convertido_em_processo' AND v_sessao.processo_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'processo_id', v_sessao.processo_id,
      'ja_convertido', true,
      'arquivos_migrados', 0
    );
  END IF;

  -- Apenas sessões concluídas/aguardando revisão podem ser convertidas
  IF v_sessao.status NOT IN ('concluido', 'aguardando_revisao', 'rascunho') THEN
    RAISE EXCEPTION 'STATUS_INVALIDO: Sessão está em status "%" — não pode ser convertida', v_sessao.status;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 2) Extrair dados (confirmados > extraidos > vazio)
  -- ══════════════════════════════════════════════════════════════════
  v_dados := COALESCE(
    NULLIF(v_sessao.dados_confirmados, '{}'::jsonb),
    NULLIF(v_sessao.dados_extraidos, '{}'::jsonb),
    '{}'::jsonb
  );

  -- FormularioRevisao salva em "diplomado", dados_extraidos usa "aluno"
  v_aluno        := COALESCE(v_dados->'diplomado', v_dados->'aluno', '{}'::jsonb);
  v_academicos   := COALESCE(v_dados->'academicos', v_dados->'curso', '{}'::jsonb);
  v_disciplinas  := COALESCE(v_dados->'disciplinas', '[]'::jsonb);
  v_atividades   := COALESCE(v_dados->'atividades_complementares', '[]'::jsonb);
  v_estagios     := COALESCE(v_dados->'estagios', '[]'::jsonb);
  v_habilitacoes := COALESCE(v_dados->'habilitacoes', '[]'::jsonb);
  v_genitores    := COALESCE(v_dados->'genitores', v_aluno->'genitores', '[]'::jsonb);
  v_enade        := COALESCE(v_dados->'enade', '{}'::jsonb);

  -- CPF e nome são obrigatórios
  v_cpf_limpo  := regexp_replace(COALESCE(v_aluno->>'cpf', ''), '[^0-9]', '', 'g');
  -- FormularioRevisao usa "nome_completo", dados_extraidos usa "nome"
  v_nome_aluno := COALESCE(v_aluno->>'nome_completo', v_aluno->>'nome', v_aluno->>'nome_aluno', '');

  IF v_cpf_limpo = '' OR v_nome_aluno = '' THEN
    RAISE EXCEPTION 'DADOS_INCOMPLETOS: CPF e nome do aluno são obrigatórios para criar processo';
  END IF;

  -- Nome do processo = "{CPF} - {NOME}" (regra Marcelo)
  v_nome_processo := v_cpf_limpo || ' - ' || v_nome_aluno;

  -- Curso ID
  v_curso_id := NULLIF(v_dados->>'curso_id', '')::UUID;
  IF v_curso_id IS NULL THEN
    v_curso_id := NULLIF(v_academicos->>'curso_id', '')::UUID;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- FIX #1: Normalizar UFs (nome completo → sigla 2 chars)
  -- ══════════════════════════════════════════════════════════════════
  v_nat_uf_raw := COALESCE(
    NULLIF(v_aluno->>'naturalidade_uf', ''),
    NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), ' - ', 2), ''),
    NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), '/', 2), '')
  );
  v_nat_uf := normalizar_uf(v_nat_uf_raw);

  v_rg_uf_raw := NULLIF(v_aluno->>'rg_uf', '');
  v_rg_uf := normalizar_uf(v_rg_uf_raw);

  -- ══════════════════════════════════════════════════════════════════
  -- 3) Criar processos_emissao
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO processos_emissao (
    nome, curso_id, turno, periodo_letivo, data_colacao,
    status, total_diplomas, created_by
  ) VALUES (
    v_nome_processo,
    v_curso_id,
    NULLIF(v_academicos->>'turno', ''),
    NULLIF(v_academicos->>'periodo_letivo', ''),
    NULLIF(v_academicos->>'data_colacao', '')::DATE,
    'rascunho',
    1,
    v_sessao.usuario_id
  )
  RETURNING id INTO v_processo_id;

  -- ══════════════════════════════════════════════════════════════════
  -- 4) Upsert diplomado por CPF
  -- ══════════════════════════════════════════════════════════════════

  -- Mapear sexo
  v_sexo_raw := LOWER(COALESCE(v_aluno->>'sexo', ''));
  IF v_sexo_raw IN ('masculino', 'm') THEN v_sexo_db := 'M';
  ELSIF v_sexo_raw IN ('feminino', 'f') THEN v_sexo_db := 'F';
  ELSE v_sexo_db := NULL;
  END IF;

  SELECT id INTO v_diplomado_id
    FROM diplomados
   WHERE cpf = v_cpf_limpo
   FOR UPDATE;

  IF v_diplomado_id IS NOT NULL THEN
    -- Atualizar dados existentes
    UPDATE diplomados SET
      nome                  = v_nome_aluno,
      nome_social           = NULLIF(v_aluno->>'nome_social', ''),
      data_nascimento       = COALESCE(NULLIF(v_aluno->>'data_nascimento', '')::DATE, data_nascimento),
      sexo                  = COALESCE(v_sexo_db::sexo_tipo, sexo),
      nacionalidade         = COALESCE(NULLIF(v_aluno->>'nacionalidade', ''), nacionalidade),
      naturalidade_municipio = COALESCE(
        NULLIF(v_aluno->>'naturalidade_municipio', ''),
        NULLIF(v_aluno->>'naturalidade_cidade', ''),
        NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), ' - ', 1), ''),
        NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), '/', 1), ''),
        naturalidade_municipio
      ),
      naturalidade_uf       = COALESCE(v_nat_uf, naturalidade_uf),
      -- FIX #2: ler rg_orgao_expedidor OU rg_orgao (FormularioRevisao usa nomes diferentes)
      rg_numero             = COALESCE(NULLIF(v_aluno->>'rg_numero', ''), rg_numero),
      rg_orgao_expedidor    = COALESCE(NULLIF(v_aluno->>'rg_orgao_expedidor', ''), NULLIF(v_aluno->>'rg_orgao', ''), rg_orgao_expedidor),
      rg_uf                 = COALESCE(v_rg_uf, rg_uf),
      ra                    = COALESCE(NULLIF(v_aluno->>'ra', ''), ra),
      email                 = COALESCE(NULLIF(v_aluno->>'email', ''), email),
      telefone              = COALESCE(NULLIF(v_aluno->>'telefone', ''), telefone),
      codigo_municipio_ibge = COALESCE(NULLIF(v_aluno->>'codigo_municipio_ibge', ''), codigo_municipio_ibge),
      updated_at            = now()
    WHERE id = v_diplomado_id;

    v_diplomado_novo := FALSE;
  ELSE
    -- Criar novo diplomado
    INSERT INTO diplomados (
      cpf, nome, nome_social, data_nascimento, sexo,
      nacionalidade, naturalidade_municipio, naturalidade_uf,
      rg_numero, rg_orgao_expedidor, rg_uf, ra,
      email, telefone, codigo_municipio_ibge
    ) VALUES (
      v_cpf_limpo,
      v_nome_aluno,
      NULLIF(v_aluno->>'nome_social', ''),
      COALESCE(NULLIF(v_aluno->>'data_nascimento', '')::DATE, CURRENT_DATE),
      v_sexo_db::sexo_tipo,
      COALESCE(NULLIF(v_aluno->>'nacionalidade', ''), 'Brasileira'),
      COALESCE(
        NULLIF(v_aluno->>'naturalidade_municipio', ''),
        NULLIF(v_aluno->>'naturalidade_cidade', ''),
        NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), ' - ', 1), ''),
        NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), '/', 1), '')
      ),
      v_nat_uf,
      -- FIX #2: não ler campo "rg" genérico (pode conter CPF por engano)
      COALESCE(NULLIF(v_aluno->>'rg_numero', '')),
      COALESCE(NULLIF(v_aluno->>'rg_orgao_expedidor', ''), NULLIF(v_aluno->>'rg_orgao', '')),
      v_rg_uf,
      NULLIF(v_aluno->>'ra', ''),
      NULLIF(v_aluno->>'email', ''),
      NULLIF(v_aluno->>'telefone', ''),
      NULLIF(v_aluno->>'codigo_municipio_ibge', '')
    )
    RETURNING id INTO v_diplomado_id;

    v_diplomado_novo := TRUE;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 5) Criar diploma vinculando processo + diplomado + curso
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO diplomas (
    processo_id, diplomado_id, curso_id,
    status, estado_preenchimento, is_legado, ambiente,
    turno, data_colacao_grau, forma_acesso, data_ingresso,
    data_conclusao, situacao_aluno, codigo_curriculo,
    carga_horaria_integralizada, versao_xsd,
    emitido_por_user_id
  ) VALUES (
    v_processo_id,
    v_diplomado_id,
    v_curso_id,
    'rascunho'::status_diploma,
    'rascunho',
    FALSE,
    'homologacao',
    NULLIF(v_academicos->>'turno', ''),
    NULLIF(v_academicos->>'data_colacao', '')::DATE,
    NULLIF(v_academicos->>'forma_acesso', ''),
    NULLIF(v_academicos->>'data_ingresso', '')::DATE,
    NULLIF(v_academicos->>'data_conclusao', '')::DATE,
    COALESCE(NULLIF(v_academicos->>'situacao_discente', ''), 'Formado'),
    NULLIF(v_academicos->>'codigo_curriculo', ''),
    NULLIF(v_academicos->>'carga_horaria_integralizada', '')::INT,
    '1.05',
    v_sessao.usuario_id
  )
  RETURNING id INTO v_diploma_id;

  -- ══════════════════════════════════════════════════════════════════
  -- 6) Inserir disciplinas
  -- ══════════════════════════════════════════════════════════════════
  IF jsonb_array_length(v_disciplinas) > 0 THEN
    v_idx := 0;
    FOR v_disc IN SELECT value FROM jsonb_array_elements(v_disciplinas)
    LOOP
      v_idx := v_idx + 1;

      -- Mapear situação
      v_sit_raw := LOWER(COALESCE(v_disc->>'situacao', ''));
      CASE
        WHEN v_sit_raw IN ('aprovado','aprovada') THEN v_sit_enum := 'aprovado';
        WHEN v_sit_raw LIKE '%aproveit%' THEN v_sit_enum := 'aproveitado';
        WHEN v_sit_raw LIKE '%aprov%' THEN v_sit_enum := 'aprovado';
        WHEN v_sit_raw LIKE '%reprov%' THEN v_sit_enum := 'reprovado';
        WHEN v_sit_raw LIKE '%tranc%' THEN v_sit_enum := 'trancado';
        WHEN v_sit_raw LIKE '%curs%' THEN v_sit_enum := 'cursando';
        WHEN v_sit_raw LIKE '%disp%' THEN v_sit_enum := 'dispensado';
        ELSE v_sit_enum := 'aprovado';  -- fallback seguro
      END CASE;

      INSERT INTO diploma_disciplinas (
        diploma_id, codigo, nome, periodo, situacao,
        carga_horaria_aula, carga_horaria_relogio,
        nota, nota_ate_cem, conceito, forma_integralizacao,
        etiqueta, docente_nome, docente_titulacao, ordem
      ) VALUES (
        v_diploma_id,
        COALESCE(NULLIF(v_disc->>'codigo', ''), 'DISC-' || LPAD(v_idx::TEXT, 3, '0')),
        COALESCE(NULLIF(v_disc->>'nome', ''), 'Sem nome'),
        NULLIF(v_disc->>'periodo', ''),
        v_sit_enum::situacao_disciplina,
        NULLIF(v_disc->>'carga_horaria', '')::INT,
        NULLIF(v_disc->>'ch_hora_relogio', '')::INT,
        NULLIF(v_disc->>'nota', '')::NUMERIC,
        NULLIF(v_disc->>'nota_ate_100', '')::NUMERIC,
        NULLIF(v_disc->>'conceito', ''),
        NULLIF(v_disc->>'forma_integralizada', ''),
        NULLIF(v_disc->>'etiqueta', ''),
        NULLIF(v_disc->>'nome_docente', ''),
        NULLIF(v_disc->>'titulacao_docente', ''),
        v_idx
      );
    END LOOP;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 7) Inserir atividades complementares
  -- ══════════════════════════════════════════════════════════════════
  IF jsonb_array_length(v_atividades) > 0 THEN
    FOR v_ativ IN SELECT value FROM jsonb_array_elements(v_atividades)
    LOOP
      INSERT INTO diploma_atividades_complementares (
        diploma_id, descricao, carga_horaria_relogio, tipo,
        data_inicio, data_fim
      ) VALUES (
        v_diploma_id,
        COALESCE(NULLIF(v_ativ->>'descricao', ''), NULLIF(v_ativ->>'nome', ''), 'Sem descrição'),
        NULLIF(v_ativ->>'carga_horaria', '')::INT,
        NULLIF(v_ativ->>'tipo', ''),
        NULLIF(v_ativ->>'data_inicio', '')::DATE,
        NULLIF(v_ativ->>'data_fim', '')::DATE
      );
    END LOOP;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 8) Inserir estágios
  -- ══════════════════════════════════════════════════════════════════
  IF jsonb_array_length(v_estagios) > 0 THEN
    FOR v_est IN SELECT value FROM jsonb_array_elements(v_estagios)
    LOOP
      INSERT INTO diploma_estagios (
        diploma_id, descricao, carga_horaria_relogio,
        concedente_razao_social, data_inicio, data_fim
      ) VALUES (
        v_diploma_id,
        COALESCE(NULLIF(v_est->>'descricao', ''), NULLIF(v_est->>'nome', ''), 'Sem descrição'),
        NULLIF(v_est->>'carga_horaria', '')::INT,
        COALESCE(NULLIF(v_est->>'empresa', ''), NULLIF(v_est->>'concedente', '')),
        NULLIF(v_est->>'data_inicio', '')::DATE,
        NULLIF(v_est->>'data_fim', '')::DATE
      );
    END LOOP;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 9) Inserir habilitações
  -- ══════════════════════════════════════════════════════════════════
  IF jsonb_array_length(v_habilitacoes) > 0 THEN
    FOR v_hab IN SELECT value FROM jsonb_array_elements(v_habilitacoes)
    LOOP
      INSERT INTO diploma_habilitacoes (
        diploma_id, nome, data_habilitacao
      ) VALUES (
        v_diploma_id,
        COALESCE(NULLIF(v_hab->>'nome', ''), 'Sem nome'),
        COALESCE(NULLIF(v_hab->>'data_conclusao', ''), NULLIF(v_hab->>'data_habilitacao', ''))::DATE
      );
    END LOOP;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 10) Inserir filiações (genitores)
  -- ══════════════════════════════════════════════════════════════════
  IF jsonb_array_length(v_genitores) > 0 THEN
    -- Se diplomado já existia, limpar filiações antigas (upsert limpo)
    IF NOT v_diplomado_novo THEN
      DELETE FROM filiacoes WHERE diplomado_id = v_diplomado_id;
    END IF;

    v_idx := 0;
    FOR v_gen IN SELECT value FROM jsonb_array_elements(v_genitores)
    LOOP
      v_idx := v_idx + 1;

      v_sexo_raw := LOWER(COALESCE(v_gen->>'sexo', ''));
      IF v_sexo_raw IN ('masculino', 'm') THEN v_sexo_db := 'M';
      ELSIF v_sexo_raw IN ('feminino', 'f') THEN v_sexo_db := 'F';
      ELSE v_sexo_db := NULL;
      END IF;

      INSERT INTO filiacoes (
        diplomado_id, nome, nome_social, sexo, ordem
      ) VALUES (
        v_diplomado_id,
        COALESCE(NULLIF(v_gen->>'nome', ''), 'Não informado'),
        NULLIF(v_gen->>'nome_social', ''),
        v_sexo_db::sexo_tipo,
        v_idx
      );
    END LOOP;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 11) FIX #3: Inserir ENADE (lê "situacao" OU deriva de "habilitado"/"condicao")
  -- ══════════════════════════════════════════════════════════════════
  v_enade_situacao := COALESCE(
    NULLIF(v_enade->>'situacao', ''),
    -- Derivar situacao a partir de "habilitado" e "condicao"
    CASE
      WHEN LOWER(COALESCE(v_enade->>'habilitado', '')) IN ('sim', 'yes', 'true') THEN 'Regular'
      WHEN LOWER(COALESCE(v_enade->>'habilitado', '')) IN ('nao', 'não', 'no', 'false') THEN
        CASE
          WHEN v_enade->>'condicao' IS NOT NULL AND v_enade->>'condicao' != '' THEN v_enade->>'condicao'
          ELSE 'Irregular'
        END
      ELSE NULL
    END
  );

  v_enade_ano := COALESCE(
    NULLIF(v_enade->>'ano_edicao', '')::INT,
    NULLIF(v_enade->>'edicao', '')::INT
  );

  IF v_enade_situacao IS NOT NULL AND v_enade_ano IS NOT NULL THEN
    INSERT INTO diploma_enade (
      diploma_id, situacao, condicao, ano_edicao
    ) VALUES (
      v_diploma_id,
      v_enade_situacao,
      NULLIF(v_enade->>'condicao', ''),
      v_enade_ano
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 12) Migrar processo_arquivos: sessao_id → processo_id + diploma_id
  -- ══════════════════════════════════════════════════════════════════
  UPDATE processo_arquivos
     SET processo_id = v_processo_id,
         diploma_id  = v_diploma_id,
         updated_at  = now()
   WHERE sessao_id = p_sessao_id
     AND processo_id IS NULL;

  GET DIAGNOSTICS v_arquivos_count = ROW_COUNT;

  -- ══════════════════════════════════════════════════════════════════
  -- 13) Registrar override (se houver justificativa)
  -- ══════════════════════════════════════════════════════════════════
  IF p_override_justificativa IS NOT NULL AND LENGTH(TRIM(p_override_justificativa)) >= 10 THEN
    INSERT INTO validacao_overrides (
      entidade_tipo, entidade_id, regra_codigo,
      valores_originais, justificativa, usuario_id
    ) VALUES (
      'extracao_sessao',
      p_sessao_id::TEXT,
      'GATE_CRIACAO_PROCESSO',
      jsonb_build_object('sessao_id', p_sessao_id, 'dados', v_dados),
      TRIM(p_override_justificativa),
      v_sessao.usuario_id
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- 14) Atualizar sessão para convertida
  -- ══════════════════════════════════════════════════════════════════
  UPDATE extracao_sessoes
     SET status      = 'convertido_em_processo',
         processo_id = v_processo_id,
         updated_at  = now()
   WHERE id = p_sessao_id;

  -- ══════════════════════════════════════════════════════════════════
  -- Resultado
  -- ══════════════════════════════════════════════════════════════════
  RETURN jsonb_build_object(
    'processo_id',      v_processo_id,
    'diploma_id',       v_diploma_id,
    'diplomado_id',     v_diplomado_id,
    'ja_convertido',    FALSE,
    'arquivos_migrados', v_arquivos_count,
    'enade_inserido',   (v_enade_situacao IS NOT NULL AND v_enade_ano IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.converter_sessao_em_processo(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.converter_sessao_em_processo(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.converter_sessao_em_processo IS
  'Converte extracao_sessao em processos_emissao+diploma+diplomado. v2: fix UF/RG/ENADE. Sessão 058.';
