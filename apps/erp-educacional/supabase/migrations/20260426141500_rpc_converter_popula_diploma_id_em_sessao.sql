-- Fix: a RPC converter_sessao_em_processo nunca populava
-- extracao_sessoes.diploma_id no UPDATE final (Step 14). Resultado:
-- páginas de revisão não conseguiam navegar de volta pro pipeline
-- (sem o diploma_id, caíam em fallback pra rota deletada
-- /diploma/processos/[id]).
--
-- Diff cirúrgico: adiciona diploma_id = v_diploma_id no Step 14.

CREATE OR REPLACE FUNCTION public.converter_sessao_em_processo(p_sessao_id uuid, p_override_justificativa text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_comprobatorios_count INT := 0;
  v_disc             JSONB;
  v_idx              INT;
  v_ativ             JSONB;
  v_est              JSONB;
  v_hab              JSONB;
  v_gen              JSONB;
  v_nat_uf_raw       TEXT;
  v_nat_uf           TEXT;
  v_rg_uf_raw        TEXT;
  v_rg_uf            TEXT;
  v_enade_situacao   TEXT;
  v_enade_ano        INT;
BEGIN
  SELECT id, usuario_id, status, processo_id,
         dados_confirmados, dados_extraidos
    INTO v_sessao
    FROM extracao_sessoes
   WHERE id = p_sessao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSAO_NAO_ENCONTRADA: Sessão % não existe', p_sessao_id;
  END IF;

  IF v_sessao.status = 'convertido_em_processo' AND v_sessao.processo_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'processo_id', v_sessao.processo_id,
      'ja_convertido', true,
      'arquivos_migrados', 0,
      'comprobatorios_inseridos', 0
    );
  END IF;

  IF v_sessao.status NOT IN ('concluido', 'aguardando_revisao', 'rascunho') THEN
    RAISE EXCEPTION 'STATUS_INVALIDO: Sessão está em status "%" — não pode ser convertida', v_sessao.status;
  END IF;

  v_dados := COALESCE(
    NULLIF(v_sessao.dados_confirmados, '{}'::jsonb),
    NULLIF(v_sessao.dados_extraidos, '{}'::jsonb),
    '{}'::jsonb
  );

  v_aluno        := COALESCE(v_dados->'diplomado', v_dados->'aluno', '{}'::jsonb);
  v_academicos   := COALESCE(v_dados->'academicos', v_dados->'curso', '{}'::jsonb);
  v_disciplinas  := COALESCE(v_dados->'disciplinas', '[]'::jsonb);
  v_atividades   := COALESCE(v_dados->'atividades_complementares', '[]'::jsonb);
  v_estagios     := COALESCE(v_dados->'estagios', '[]'::jsonb);
  v_habilitacoes := COALESCE(v_dados->'habilitacoes', '[]'::jsonb);
  v_genitores    := COALESCE(v_dados->'genitores', v_aluno->'genitores', '[]'::jsonb);
  v_enade        := COALESCE(v_dados->'enade', '{}'::jsonb);

  v_cpf_limpo  := regexp_replace(COALESCE(v_aluno->>'cpf', ''), '[^0-9]', '', 'g');
  v_nome_aluno := COALESCE(v_aluno->>'nome_completo', v_aluno->>'nome', v_aluno->>'nome_aluno', '');

  IF v_cpf_limpo = '' OR v_nome_aluno = '' THEN
    RAISE EXCEPTION 'DADOS_INCOMPLETOS: CPF e nome do aluno são obrigatórios para criar processo';
  END IF;

  v_nome_processo := v_cpf_limpo || ' - ' || v_nome_aluno;

  v_curso_id := NULLIF(v_dados->>'curso_id', '')::UUID;
  IF v_curso_id IS NULL THEN
    v_curso_id := NULLIF(v_academicos->>'curso_id', '')::UUID;
  END IF;

  v_nat_uf_raw := COALESCE(
    NULLIF(v_aluno->>'naturalidade_uf', ''),
    NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), ' - ', 2), ''),
    NULLIF(split_part(COALESCE(v_aluno->>'naturalidade', ''), '/', 2), '')
  );
  v_nat_uf := normalizar_uf(v_nat_uf_raw);

  v_rg_uf_raw := NULLIF(v_aluno->>'rg_uf', '');
  v_rg_uf := normalizar_uf(v_rg_uf_raw);

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
      rg_numero             = COALESCE(
        NULLIF(v_aluno->>'rg', ''),
        NULLIF(v_aluno->>'rg_numero', ''),
        rg_numero
      ),
      rg_orgao_expedidor    = COALESCE(
        NULLIF(v_aluno->>'rg_orgao_expedidor', ''),
        NULLIF(v_aluno->>'rg_orgao', ''),
        rg_orgao_expedidor
      ),
      rg_uf                 = COALESCE(v_rg_uf, rg_uf),
      ra                    = COALESCE(NULLIF(v_aluno->>'ra', ''), ra),
      email                 = COALESCE(NULLIF(v_aluno->>'email', ''), email),
      telefone              = COALESCE(NULLIF(v_aluno->>'telefone', ''), telefone),
      codigo_municipio_ibge = COALESCE(
        NULLIF(v_aluno->>'naturalidade_codigo_municipio', ''),
        NULLIF(v_aluno->>'codigo_municipio_ibge', ''),
        codigo_municipio_ibge
      ),
      updated_at            = now()
    WHERE id = v_diplomado_id;
    v_diplomado_novo := FALSE;
  ELSE
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
      COALESCE(NULLIF(v_aluno->>'rg', ''), NULLIF(v_aluno->>'rg_numero', '')),
      COALESCE(NULLIF(v_aluno->>'rg_orgao_expedidor', ''), NULLIF(v_aluno->>'rg_orgao', '')),
      v_rg_uf,
      NULLIF(v_aluno->>'ra', ''),
      NULLIF(v_aluno->>'email', ''),
      NULLIF(v_aluno->>'telefone', ''),
      COALESCE(
        NULLIF(v_aluno->>'naturalidade_codigo_municipio', ''),
        NULLIF(v_aluno->>'codigo_municipio_ibge', '')
      )
    )
    RETURNING id INTO v_diplomado_id;
    v_diplomado_novo := TRUE;
  END IF;

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

  IF jsonb_array_length(v_disciplinas) > 0 THEN
    v_idx := 0;
    FOR v_disc IN SELECT value FROM jsonb_array_elements(v_disciplinas)
    LOOP
      v_idx := v_idx + 1;
      v_sit_raw := LOWER(COALESCE(v_disc->>'situacao', ''));
      CASE
        WHEN v_sit_raw IN ('aprovado','aprovada') THEN v_sit_enum := 'aprovado';
        WHEN v_sit_raw LIKE '%aproveit%' THEN v_sit_enum := 'aproveitado';
        WHEN v_sit_raw LIKE '%aprov%' THEN v_sit_enum := 'aprovado';
        WHEN v_sit_raw LIKE '%reprov%' THEN v_sit_enum := 'reprovado';
        WHEN v_sit_raw LIKE '%tranc%' THEN v_sit_enum := 'trancado';
        WHEN v_sit_raw LIKE '%curs%' THEN v_sit_enum := 'cursando';
        WHEN v_sit_raw LIKE '%disp%' THEN v_sit_enum := 'dispensado';
        ELSE v_sit_enum := 'aprovado';
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
        COALESCE(
          NULLIF(v_disc->>'ch_hora_relogio', '')::INT,
          NULLIF(v_disc->>'carga_horaria_relogio', '')::INT
        ),
        NULLIF(v_disc->>'nota', '')::NUMERIC,
        COALESCE(
          NULLIF(v_disc->>'nota_ate_100', '')::NUMERIC,
          NULLIF(v_disc->>'nota_ate_cem', '')::NUMERIC
        ),
        NULLIF(v_disc->>'conceito', ''),
        COALESCE(
          NULLIF(v_disc->>'forma_integralizacao', ''),
          NULLIF(v_disc->>'forma_integralizada', '')
        ),
        NULLIF(v_disc->>'etiqueta', ''),
        COALESCE(
          NULLIF(v_disc->>'docente', ''),
          NULLIF(v_disc->>'nome_docente', ''),
          NULLIF(v_disc->>'docente_nome', '')
        ),
        COALESCE(
          NULLIF(v_disc->>'titulacao_docente', ''),
          NULLIF(v_disc->>'docente_titulacao', '')
        ),
        v_idx
      );
    END LOOP;
  END IF;

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

  IF jsonb_array_length(v_genitores) > 0 THEN
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

  v_enade_situacao := COALESCE(
    NULLIF(v_enade->>'situacao', ''),
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

  UPDATE processo_arquivos
     SET processo_id = v_processo_id,
         diploma_id  = v_diploma_id,
         updated_at  = now()
   WHERE sessao_id = p_sessao_id
     AND processo_id IS NULL;

  GET DIAGNOSTICS v_arquivos_count = ROW_COUNT;

  INSERT INTO diploma_documentos_comprobatorios (
    processo_id,
    arquivo_origem_id,
    diploma_id,
    tipo_xsd,
    selecionado_por,
    selecionado_em
  )
  SELECT
    v_processo_id,
    pa.id,
    NULL,
    CASE pa.tipo_xsd
      WHEN 'DocumentoIdentidadeDoAluno'   THEN 'DocumentoIdentidadeDoAluno'
      WHEN 'ProvaConclusaoEnsinoMedio'    THEN 'ProvaConclusaoEnsinoMedio'
      WHEN 'ProvaColacao'                 THEN 'ProvaColacao'
      WHEN 'ComprovacaoEstagioCurricular' THEN 'ComprovacaoEstagioCurricular'
      WHEN 'CertidaoNascimento'           THEN 'CertidaoNascimento'
      WHEN 'CertidaoCasamento'            THEN 'CertidaoCasamento'
      WHEN 'TituloEleitor'                THEN 'TituloEleitor'
      WHEN 'AtoNaturalizacao'             THEN 'AtoNaturalizacao'
      ELSE                                     'Outros'
    END::tipo_documento_comprobatorio,
    v_sessao.usuario_id,
    now()
  FROM processo_arquivos pa
  WHERE pa.sessao_id = p_sessao_id
    AND pa.destino_acervo = true
  ON CONFLICT (processo_id, arquivo_origem_id) WHERE (deleted_at IS NULL) DO NOTHING;

  GET DIAGNOSTICS v_comprobatorios_count = ROW_COUNT;

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

  -- Step 14 (FIX 2026-04-26): popular diploma_id na sessão pra UI poder
  -- navegar de volta pro pipeline (/diploma/diplomas/{diploma_id}).
  UPDATE extracao_sessoes
     SET status      = 'convertido_em_processo',
         processo_id = v_processo_id,
         diploma_id  = v_diploma_id,
         updated_at  = now()
   WHERE id = p_sessao_id;

  RETURN jsonb_build_object(
    'processo_id',              v_processo_id,
    'diploma_id',               v_diploma_id,
    'diplomado_id',             v_diplomado_id,
    'ja_convertido',            FALSE,
    'arquivos_migrados',        v_arquivos_count,
    'comprobatorios_inseridos', v_comprobatorios_count,
    'enade_inserido',           (v_enade_situacao IS NOT NULL AND v_enade_ano IS NOT NULL)
  );
END;
$function$;

-- Backfill: popular diploma_id em sessões já convertidas
UPDATE extracao_sessoes es
   SET diploma_id = d.id
  FROM diplomas d
 WHERE d.processo_id = es.processo_id
   AND es.processo_id IS NOT NULL
   AND es.diploma_id IS NULL;
