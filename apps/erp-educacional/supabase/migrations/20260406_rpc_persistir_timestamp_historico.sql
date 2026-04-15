-- ============================================================================
-- Função RPC: persistir_timestamp_historico
-- ============================================================================
-- Persiste atomicamente data/hora/código de validação do histórico de um
-- diploma, garantindo reprodutibilidade do hash SHA256 (Anexo III IN 05/2020
-- SESu/MEC) em auditorias do MEC.
--
-- Semântica:
--   1. Faz SELECT ... FOR UPDATE para travar a linha do diploma.
--   2. Se codigo_validacao_historico já estiver persistido, retorna o tuplo
--      existente (data, hora, código) — descarta os candidatos enviados.
--   3. Caso contrário, persiste os 3 valores candidatos como um TUPLO ATÔMICO
--      (nunca mistura data de uma chamada com hora de outra).
--
-- Resolve race condition: 2 requisições paralelas sobre o mesmo diploma fresh
-- agora convergem para o mesmo tuplo persistido — quem perder a corrida lê o
-- tuplo do vencedor e gera o XML com o hash correto.
--
-- Bug #12 — referência: src/lib/xml/montador.ts montarDadosDiploma()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.persistir_timestamp_historico(
  p_diploma_id uuid,
  p_data       date,
  p_hora       time without time zone,
  p_codigo     text
)
RETURNS TABLE (
  data_emissao_historico     date,
  hora_emissao_historico     time without time zone,
  codigo_validacao_historico text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data   date;
  v_hora   time without time zone;
  v_codigo text;
BEGIN
  -- Valida inputs obrigatórios
  IF p_diploma_id IS NULL THEN
    RAISE EXCEPTION 'persistir_timestamp_historico: p_diploma_id é obrigatório';
  END IF;

  IF p_data IS NULL OR p_hora IS NULL OR p_codigo IS NULL OR p_codigo = '' THEN
    RAISE EXCEPTION 'persistir_timestamp_historico: p_data, p_hora e p_codigo são obrigatórios';
  END IF;

  -- Trava a linha do diploma para evitar race condition
  SELECT d.data_emissao_historico,
         d.hora_emissao_historico,
         d.codigo_validacao_historico
    INTO v_data, v_hora, v_codigo
    FROM public.diplomas d
    WHERE d.id = p_diploma_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'persistir_timestamp_historico: diploma % não encontrado', p_diploma_id;
  END IF;

  -- Pivot: se o código já está persistido, confiamos no tuplo existente
  -- (data + hora + código formam um tuplo atômico — não pode haver mistura).
  IF v_codigo IS NULL OR v_codigo = '' THEN
    UPDATE public.diplomas
       SET data_emissao_historico     = p_data,
           hora_emissao_historico     = p_hora,
           codigo_validacao_historico = p_codigo
     WHERE id = p_diploma_id;

    v_data   := p_data;
    v_hora   := p_hora;
    v_codigo := p_codigo;
  END IF;

  -- Retorna o tuplo canônico (recém persistido OU pré-existente)
  data_emissao_historico     := v_data;
  hora_emissao_historico     := v_hora;
  codigo_validacao_historico := v_codigo;
  RETURN NEXT;
END;
$$;

-- Permite que roles autenticados (e service_role) chamem a função
GRANT EXECUTE ON FUNCTION public.persistir_timestamp_historico(uuid, date, time, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.persistir_timestamp_historico(uuid, date, time, text) IS
  'Persiste atomicamente data/hora/código do histórico de um diploma com SELECT FOR UPDATE. Retorna o tuplo canônico (recém-persistido ou pré-existente). Usado pelo motor XML para garantir reprodutibilidade do SHA256 do Anexo III IN 05/2020 SESu/MEC. Bug #12.';
