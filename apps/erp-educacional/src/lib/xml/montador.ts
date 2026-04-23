/**
 * Montador de dados do Diploma Digital
 * Busca dados do banco Supabase e monta o objeto DadosDiploma pronto para geração XML
 * Conforme XSD v1.05
 */

import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  DadosDiploma,
  Disciplina,
  AtividadeComplementar,
  Estagio,
  Assinante,
  EnderecoXSD,
  AtoRegulatorio,
  EnadeInfo,
  Genitor,
  DocenteInfo,
  CargaHorariaComEtiqueta,
  CargaHorariaRelogioComEtiqueta,
  TFormaAcesso,
} from "./tipos";
import { aplicarSnapshotSobreDadosDiploma } from "../diploma/snapshot-to-dados-diploma";
import type { DadosSnapshot } from "../diploma/snapshot";

// ============================================================
// CÓDIGO DE VALIDAÇÃO DO HISTÓRICO — Anexo III IN 05/2020 MEC
// ============================================================

/**
 * Parâmetros da fórmula oficial do código de validação do Histórico.
 * Conforme Anexo III, Item 2 da Instrução Normativa SESu/MEC nº 05/2020.
 */
export interface ParamsCodigoValidacaoHistorico {
  /** RA do diplomado (só dígitos — caracteres não numéricos são removidos) */
  ra: string;
  /** CPF do diplomado (só dígitos) */
  cpf: string;
  /** Código e-MEC do curso (só dígitos) */
  codigoCursoEMEC: string;
  /** CNPJ da IES Emissora (só dígitos) */
  cnpjEmissora: string;
  /** Código e-MEC da IES Emissora (ex: '1606' para a FIC) */
  codigoMecEmissora: string;
  /** Data de emissão do histórico — ISO 'YYYY-MM-DD' */
  dataEmissaoHistorico: string;
  /** Hora de emissão do histórico — 'HH:MM' ou 'HH:MM:SS' */
  horaEmissaoHistorico: string;
}

/**
 * Gera código de validação do Histórico Escolar Digital conforme
 * Anexo III, Item 2 da IN 05/2020 do SESu/MEC.
 *
 * Fórmula oficial:
 *   input = RA || CPF || CodigoCursoEMEC || CNPJ_IesEmissora || DataeHora
 *   DataeHora = DDMMAAAAHHMM (sem separadores)
 *   hash = SHA256(input, UTF-8)
 *   código = CodigoMEC_Emissora + '.' + primeiros 12 chars hex do hash
 *
 * Observação: a concatenação NÃO usa separadores entre os campos, e cada
 * campo é limpo (só dígitos) antes de concatenar.
 *
 * ATENÇÃO: Esta função é DETERMINÍSTICA. Para o código ser reproduzível
 * em auditorias do MEC, a dataEmissaoHistorico e horaEmissaoHistorico
 * devem ser PERSISTIDAS no banco na primeira geração e reutilizadas nas
 * chamadas subsequentes. Ver montarDadosDiploma() para a lógica de persistência.
 */
export function gerarCodigoValidacaoHistorico(
  params: ParamsCodigoValidacaoHistorico,
): string {
  const limparDigitos = (s: string | null | undefined): string =>
    (s || "").replace(/\D/g, "");

  const ra = limparDigitos(params.ra);
  const cpf = limparDigitos(params.cpf);
  const codigoCurso = limparDigitos(params.codigoCursoEMEC);
  const cnpj = limparDigitos(params.cnpjEmissora);

  if (!ra || !cpf || !codigoCurso || !cnpj) {
    throw new Error(
      "gerarCodigoValidacaoHistorico: RA, CPF, CodigoCursoEMEC e CNPJ são obrigatórios",
    );
  }

  // Converte 'YYYY-MM-DD' → 'DDMMAAAA'
  const matchData = params.dataEmissaoHistorico.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );
  if (!matchData) {
    throw new Error(
      `gerarCodigoValidacaoHistorico: data inválida (esperado YYYY-MM-DD, recebido "${params.dataEmissaoHistorico}")`,
    );
  }
  const [, ano, mes, dia] = matchData;
  const dataFormatada = `${dia}${mes}${ano}`;

  // Converte 'HH:MM[:SS]' → 'HHMM'
  const matchHora = params.horaEmissaoHistorico.match(/^(\d{1,2}):(\d{1,2})/);
  if (!matchHora) {
    throw new Error(
      `gerarCodigoValidacaoHistorico: hora inválida (esperado HH:MM, recebido "${params.horaEmissaoHistorico}")`,
    );
  }
  const [, hh, mm] = matchHora;
  const horaFormatada = `${hh.padStart(2, "0")}${mm.padStart(2, "0")}`;

  const dataeHora = `${dataFormatada}${horaFormatada}`; // DDMMAAAAHHMM (12 dígitos)

  // Concatena SEM separadores e calcula SHA256
  const input = `${ra}${cpf}${codigoCurso}${cnpj}${dataeHora}`;
  const hash = crypto.createHash("sha256").update(input, "utf8").digest("hex");
  const hex12 = hash.substring(0, 12);

  // .trim() defensivo: evita prefixo "1606 .abc..." caso o banco devolva whitespace
  const codigoMec = (params.codigoMecEmissora || "").trim();
  return `${codigoMec}.${hex12}`;
}

/**
 * Retorna data e hora atuais no fuso America/Sao_Paulo, no formato
 * { data: 'YYYY-MM-DD', hora: 'HH:MM:SS' }.
 *
 * Necessário porque o servidor (Vercel) roda em UTC — usar new Date()
 * direto pode gerar DDMMAAAA errado após ~21h-horário de Brasília.
 */
export function gerarDataHoraBrasil(): { data: string; hora: string } {
  const agora = new Date();
  // Usa Intl para extrair componentes no fuso de SP
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(agora).reduce(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  const data = `${parts.year}-${parts.month}-${parts.day}`;
  // Intl pode retornar '24' em vez de '00' para meia-noite em alguns runtimes
  const horaRaw = parts.hour === "24" ? "00" : parts.hour;
  const hora = `${horaRaw}:${parts.minute}:${parts.second}`;
  return { data, hora };
}

/**
 * @deprecated Use gerarCodigoValidacaoHistorico() com params completos.
 * Código de validação do diploma é gerado pela REGISTRADORA, não pela emissora.
 */
export function gerarCodigoValidacao(): string {
  throw new Error(
    "gerarCodigoValidacao() está depreciado. O código do diploma é gerado pela registradora; use gerarCodigoValidacaoHistorico() para o histórico da emissora.",
  );
}

// ============================================================
// BUSCA DOS ATOS REGULATÓRIOS DA IES (Credenciamento/Recredenciamento)
// ============================================================

interface AtosIES {
  credenciamento: AtoRegulatorio;
  recredenciamento?: AtoRegulatorio;
}

// ============================================================
// BUSCA DOS ATOS REGULATÓRIOS DO CURSO (Bug #G)
// Autorizacao + Reconhecimento + RenovacaoReconhecimento
// ============================================================

interface AtosCurso {
  autorizacao?: AtoRegulatorio;
  reconhecimento?: AtoRegulatorio;
  renovacao_reconhecimento?: AtoRegulatorio;
}

/**
 * Converte uma linha da tabela `atos_curso` para o tipo AtoRegulatorio.
 * Mesma forma usada por `linhaCredenciamentoParaAto` (atos_curso espelha
 * a estrutura de `credenciamentos`).
 */
function linhaAtoCursoParaAto(row: {
  tipo_ato: string | null;
  numero: string | null;
  data: string | null;
  veiculo_publicacao: string | null;
  data_publicacao_dou: string | null;
  secao_dou: string | null;
  pagina_dou: string | null;
  numero_dou: string | null;
}): AtoRegulatorio {
  return {
    tipo: row.tipo_ato || "",
    numero: row.numero || "",
    data: row.data || "",
    veiculo_publicacao: row.veiculo_publicacao || undefined,
    data_publicacao: row.data_publicacao_dou || undefined,
    secao_publicacao: row.secao_dou || undefined,
    pagina_publicacao: row.pagina_dou || undefined,
    numero_dou: row.numero_dou || undefined,
  };
}

/**
 * Busca os atos regulatórios do curso da tabela dedicada `atos_curso`.
 *
 * Regra de negócio (XSD v1.05):
 * - <Autorizacao> aparece 1x no XML. Pegamos o registro mais antigo (1ª autorização).
 * - <Reconhecimento> aparece 1x no XML. Pegamos o registro mais antigo (1º reconhecimento).
 * - <RenovacaoReconhecimento> opcional. Quando há, pegamos o MAIS RECENTE
 *   (representa o estado atual de regularidade do curso).
 *
 * Bug #G — substitui a leitura dos campos planos da tabela `cursos`
 * (tipo_autorizacao, tipo_reconhecimento, tipo_renovacao etc.).
 */
async function buscarAtosCurso(
  supabase: SupabaseClient,
  cursoId: string,
): Promise<AtosCurso> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("atos_curso")
    .select(
      "tipo, tipo_ato, numero, data, veiculo_publicacao, numero_dou, data_publicacao_dou, secao_dou, pagina_dou",
    )
    .eq("curso_id", cursoId)
    .order("data", { ascending: true });

  if (error) {
    throw new Error(
      `Erro ao buscar atos regulatórios do curso: ${error.message}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data || []) as any[];

  // Autorização — primeira (mais antiga)
  const autRow = rows.find((r) => r.tipo === "Autorizacao");

  // Reconhecimento — primeiro (mais antigo)
  const recRow = rows.find((r) => r.tipo === "Reconhecimento");

  // Renovação — última (mais recente) — opcional
  const renovRows = rows.filter((r) => r.tipo === "RenovacaoReconhecimento");
  const renovMaisRecente =
    renovRows.length > 0 ? renovRows[renovRows.length - 1] : undefined;

  return {
    autorizacao: autRow ? linhaAtoCursoParaAto(autRow) : undefined,
    reconhecimento: recRow ? linhaAtoCursoParaAto(recRow) : undefined,
    renovacao_reconhecimento: renovMaisRecente
      ? linhaAtoCursoParaAto(renovMaisRecente)
      : undefined,
  };
}

/**
 * Converte uma linha da tabela `credenciamentos` para o tipo AtoRegulatorio.
 */
function linhaCredenciamentoParaAto(row: {
  tipo_ato: string | null;
  numero: string | null;
  data: string | null;
  veiculo_publicacao: string | null;
  data_publicacao_dou: string | null;
  secao_dou: string | null;
  pagina_dou: string | null;
  numero_dou: string | null;
}): AtoRegulatorio {
  return {
    tipo: row.tipo_ato || "",
    numero: row.numero || "",
    data: row.data || "",
    veiculo_publicacao: row.veiculo_publicacao || undefined,
    data_publicacao: row.data_publicacao_dou || undefined,
    secao_publicacao: row.secao_dou || undefined,
    pagina_publicacao: row.pagina_dou || undefined,
    numero_dou: row.numero_dou || undefined,
  };
}

/**
 * Busca os atos regulatórios da IES (Credenciamento + Recredenciamento).
 *
 * Regra de negócio (definida pelo dono do produto, conforme XSD v1.05):
 * - O XSD aceita exatamente 1 <Credenciamento> e opcionalmente 1 <Recredenciamento>.
 * - <Credenciamento> = o registro mais ANTIGO com tipo='credenciamento' (1ª habilitação)
 * - <Recredenciamento> = o registro mais RECENTE com tipo='recredenciamento'
 *   (independente do flag vigente — representa o estado mais atual da IES)
 *
 * A FIC não usa <RenovacaoDeRecredenciamento> — esse campo do XSD existe
 * mas nunca é preenchido operacionalmente.
 */
async function buscarAtosIES(
  supabase: SupabaseClient,
  instituicaoId: string,
): Promise<AtosIES> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("credenciamentos")
    .select(
      "tipo, tipo_ato, numero, data, veiculo_publicacao, numero_dou, data_publicacao_dou, secao_dou, pagina_dou",
    )
    .eq("instituicao_id", instituicaoId)
    .order("data", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar credenciamentos da IES: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data || []) as any[];

  // Credenciamento: primeiro registro com tipo='credenciamento' (já ordenado ASC por data)
  const credRow = rows.find((r) => r.tipo === "credenciamento");
  if (!credRow) {
    throw new Error(
      `Nenhum ato de credenciamento encontrado para a IES (instituicao_id=${instituicaoId}). ` +
        "O XSD v1.05 exige pelo menos 1 <Credenciamento>. Cadastre o ato em Configurações > Instituição > Credenciamentos.",
    );
  }

  // Recredenciamento: último registro com tipo='recredenciamento' na lista ordenada ASC
  // (equivale ao mais recente). Se não houver, o elemento <Recredenciamento> é omitido.
  const recredRows = rows.filter((r) => r.tipo === "recredenciamento");
  const recredMaisRecente =
    recredRows.length > 0 ? recredRows[recredRows.length - 1] : undefined;

  return {
    credenciamento: linhaCredenciamentoParaAto(credRow),
    recredenciamento: recredMaisRecente
      ? linhaCredenciamentoParaAto(recredMaisRecente)
      : undefined,
  };
}

/**
 * Monta EnderecoXSD a partir de dados do banco
 */
function montarEndereco(
  logradouro: string,
  numero: string | null,
  complemento: string | null,
  bairro: string | null,
  codigo_municipio: string | null,
  nome_municipio: string,
  uf: string,
  cep: string,
): EnderecoXSD {
  return {
    logradouro: logradouro || "",
    numero: numero || undefined,
    complemento: complemento || undefined,
    bairro: bairro || "",
    codigo_municipio: codigo_municipio || "",
    nome_municipio: nome_municipio || "",
    uf: uf || "",
    cep: cep || "",
  };
}

/**
 * Monta AtoRegulatorio a partir de dados do banco
 */
function montarAtoRegulatorio(
  tipo: string | null,
  numero: string | null,
  data: string | null,
  veiculo_publicacao?: string | null,
  data_publicacao?: string | null,
  secao?: string | null,
  pagina?: string | null,
  numero_dou?: string | null,
): AtoRegulatorio {
  return {
    tipo: tipo || "",
    numero: numero || "",
    data: data || "",
    veiculo_publicacao: veiculo_publicacao || undefined,
    data_publicacao: data_publicacao || undefined,
    secao_publicacao: secao || undefined,
    pagina_publicacao: pagina || undefined,
    numero_dou: numero_dou || undefined,
  };
}

/**
 * Mapeia forma_acesso do banco para o enum do XSD v1.05
 */
function mapearFormaAcesso(formaAcesso: string | null): TFormaAcesso {
  const mapa: Record<string, TFormaAcesso> = {
    vestibular: "Vestibular",
    enem: "Enem",
    ENEM: "Enem",
    "avaliação seriada": "Avaliação Seriada",
    "seleção simplificada": "Seleção Simplificada",
    "transferência ex officio": "Transferência Ex Officio",
    "decisão judicial": "Decisão judicial",
    "vagas remanescentes": "Seleção para Vagas Remanescentes",
    "programas especiais": "Seleção para Vagas de Programas Especiais",
  };
  const lower = (formaAcesso || "").toLowerCase();
  return mapa[lower] || mapa[formaAcesso || ""] || "Vestibular";
}

/**
 * Busca todos os dados necessários do banco e monta DadosDiploma
 */
/**
 * Opções para o montador. `pular_regras_negocio` permite skip seletivo após
 * override humano aprovado pelo route handler (Bug #H — princípio do override).
 */
export interface MontarDadosDiplomaOptions {
  /**
   * Lista de códigos de regra de negócio a pular (REGRAS_NEGOCIO.*).
   * Usado pelo route handler quando o operador confirmou um override
   * com justificativa via modal. NÃO é utilizado para pular validação
   * de schema XSD — apenas regras semânticas.
   */
  pular_regras_negocio?: import("./validation/regras-negocio").CodigoRegra[];
}

export async function montarDadosDiploma(
  supabase: SupabaseClient,
  diplomaId: string,
  options: MontarDadosDiplomaOptions = {},
): Promise<DadosDiploma> {
  // 1. Busca diploma com joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: diplomaDataTyped, error: diplomaError } = await supabase
    .from("diplomas")
    .select(
      `
      id,
      codigo_validacao,
      data_colacao_grau,
      data_conclusao,
      segunda_via,
      forma_acesso,
      data_ingresso,
      codigo_curriculo,
      data_emissao_historico,
      carga_horaria_integralizada,
      registradora_nome,
      registradora_cnpj,
      registradora_codigo_mec,
      diplomado_id,
      curso_id,
      dados_snapshot_extracao,
      dados_snapshot_travado,
      diplomados (
        id, nome, nome_social, cpf, ra,
        data_nascimento, sexo, nacionalidade,
        naturalidade_municipio, naturalidade_uf,
        codigo_municipio_ibge,
        rg_numero, rg_orgao_expedidor, rg_uf
      ),
      cursos (
        id, nome, codigo_emec, grau, titulo_conferido,
        modalidade, carga_horaria_total,
        logradouro, numero, bairro, municipio, codigo_municipio, uf, cep,
        tipo_autorizacao, numero_autorizacao, data_autorizacao,
        veiculo_publicacao_autorizacao, data_publicacao_autorizacao,
        secao_publicacao_autorizacao, pagina_publicacao_autorizacao, numero_dou_autorizacao,
        tipo_reconhecimento, numero_reconhecimento, data_reconhecimento,
        veiculo_publicacao_reconhecimento, data_publicacao_reconhecimento,
        secao_publicacao_reconhecimento, pagina_publicacao_reconhecimento, numero_dou_reconhecimento,
        tipo_renovacao, numero_renovacao, data_renovacao,
        veiculo_publicacao_renovacao, data_publicacao_renovacao,
        secao_publicacao_renovacao, pagina_publicacao_renovacao, numero_dou_renovacao,
        enfase, codigo_curso
      )
    `,
    )
    .eq("id", diplomaId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diplomaData = diplomaDataTyped as any;

  if (diplomaError || !diplomaData) {
    throw new Error(`Diploma não encontrado: ${diplomaId}`);
  }

  if (!diplomaData.diplomados || !diplomaData.diplomados.nome) {
    throw new Error("Dados do diplomado incompletos ou ausentes");
  }

  if (!diplomaData.diplomados.cpf) {
    throw new Error("CPF do diplomado é obrigatório");
  }

  if (!diplomaData.cursos) {
    throw new Error("Dados do curso incompletos ou ausentes");
  }

  // 2. Busca instituição EMISSORA (FIC) — usa codigo_mec para garantir que pega a correta
  //
  // ATENÇÃO: NÃO lemos mais os campos legados de credenciamento da tabela `instituicoes`
  // (tipo_credenciamento, numero_credenciamento, data_credenciamento, veiculo_publicacao,
  // data_publicacao_dou, secao_dou, pagina_dou, numero_dou). Os atos regulatórios agora
  // são lidos da tabela dedicada `credenciamentos` via buscarAtosIES() — ver abaixo.
  // Os campos legados permanecem no schema mas estão órfãos (sem consumidores).
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: iesDataTyped, error: iesError } = await supabase
    .from("instituicoes")
    .select(
      `
      id, nome, cnpj, codigo_mec,
      logradouro, numero, complemento, bairro, municipio, codigo_municipio, uf, cep,
      mantenedora_nome, mantenedora_cnpj, mantenedora_razao_social, mantenedora_endereco
    `,
    )
    .eq("codigo_mec", "1606")
    .eq("ativo", true)
    .limit(1)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iesData = iesDataTyped as any;

  if (iesError || !iesData) {
    throw new Error("Nenhuma instituição ativa encontrada");
  }

  // 2b. Busca atos regulatórios (Credenciamento + Recredenciamento mais recente)
  // da tabela `credenciamentos` — fonte única de verdade conforme Bug #7.
  const atosIES = await buscarAtosIES(supabase, iesData.id);

  // 3. Busca filiações
  const { data: filiacoesData } = await supabase
    .from("filiacoes")
    .select("nome, nome_social, sexo")
    .eq("diplomado_id", diplomaData.diplomado_id);

  const filiacao: Genitor[] = (filiacoesData || []).map((f: any) => ({
    nome: f.nome,
    nome_social: f.nome_social || undefined,
    sexo: f.sexo as "M" | "F",
  }));

  // Se não tem filiações na tabela, tenta montar a partir dos campos legados
  if (filiacao.length === 0) {
    // Buscar dos campos legados se existirem no diplomado
    const { data: diplomadoExtra } = await supabase
      .from("diplomados")
      .select("id")
      .eq("id", diplomaData.diplomado_id)
      .single();
    // Placeholder — filiação será preenchida manualmente
  }

  // 4. Busca assinantes ativos
  const { data: assinantesData } = await supabase
    .from("assinantes")
    .select("nome, cpf, cargo, tipo_certificado, ordem_assinatura")
    .eq("ativo", true)
    .order("ordem_assinatura", { ascending: true });

  const assinantes: Assinante[] = (assinantesData || []).map((a: any) => ({
    nome: a.nome,
    cpf: a.cpf,
    cargo: a.cargo,
    tipo_certificado:
      a.tipo_certificado === "eCNPJ" || a.tipo_certificado?.includes("CNPJ")
        ? "eCNPJ"
        : "eCPF",
    ordem_assinatura: a.ordem_assinatura,
  }));

  // 5. Busca disciplinas
  // Bug #6 — fix 2026-04-07 (Onda 1):
  // A coluna `periodo` é TEXT, então o `.order('periodo')` do Postgres
  // ordenava lexicograficamente ('1','10','11','2','3'...). Como o XSD
  // TElementosHistorico é um sequence (1..unbounded) e a ordem entra na
  // canonicalização XAdES, a ordem incorreta produz histórico fora de
  // sequência e quebra a leitura humana do diploma.
  // Solução: buscar sem .order() do Supabase e ordenar como inteiro no JS,
  // com tiebreaker pelo código da disciplina para resultado determinístico.
  const { data: disciplinasDataRaw } = await supabase
    .from("diploma_disciplinas")
    .select(
      `
      codigo, nome, periodo, situacao,
      carga_horaria_aula, carga_horaria_relogio,
      nota, conceito, forma_integralizacao,
      docente_nome, docente_titulacao, docente_cpf
    `,
    )
    .eq("diploma_id", diplomaId);

  const disciplinasData = (disciplinasDataRaw || [])
    .slice()
    .sort((a: any, b: any) => {
      const pa = parseInt(String(a.periodo ?? "0"), 10);
      const pb = parseInt(String(b.periodo ?? "0"), 10);
      // Períodos não-numéricos (NaN) caem para o FIM da lista, agrupados.
      // Isso é intencional: dados malformados ficam visíveis no rodapé do
      // histórico ao invés de quebrar a emissão. O operador identifica e corrige.
      const safeA = Number.isFinite(pa) ? pa : Number.MAX_SAFE_INTEGER;
      const safeB = Number.isFinite(pb) ? pb : Number.MAX_SAFE_INTEGER;
      if (safeA !== safeB) return safeA - safeB;
      // Tiebreaker: código da disciplina (ordem alfabética estável)
      return String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""));
    });

  const disciplinas: Disciplina[] = (disciplinasData || []).map((d: any) => {
    // Monta array de carga horária
    const cargaHoraria: CargaHorariaComEtiqueta[] = [];
    if (d.carga_horaria_aula) {
      cargaHoraria.push({ tipo: "HoraAula", valor: d.carga_horaria_aula });
    }
    if (d.carga_horaria_relogio) {
      cargaHoraria.push({
        tipo: "HoraRelogio",
        valor: d.carga_horaria_relogio,
      });
    }
    if (cargaHoraria.length === 0) {
      cargaHoraria.push({ tipo: "HoraRelogio", valor: 0 });
    }

    // Monta docentes
    const docentes: DocenteInfo[] = d.docente_nome
      ? [
          {
            nome: d.docente_nome,
            titulacao: d.docente_titulacao || "Graduação",
            cpf: d.docente_cpf || undefined,
          },
        ]
      : [];

    // Mapeia situação
    let situacao: "Aprovado" | "Pendente" | "Reprovado" = "Aprovado";
    if (d.situacao === "Reprovado") situacao = "Reprovado";
    else if (d.situacao === "Cursando" || d.situacao === "Pendente")
      situacao = "Pendente";

    return {
      codigo: d.codigo,
      nome: d.nome,
      periodo_letivo: d.periodo || "",
      carga_horaria: cargaHoraria,
      nota: d.nota || undefined,
      conceito: d.conceito || undefined,
      situacao,
      forma_integralizacao:
        situacao === "Aprovado"
          ? (d.forma_integralizacao as any) || "Cursado"
          : undefined,
      docentes,
    };
  });

  if (disciplinas.length === 0) {
    throw new Error(
      "Nenhuma disciplina encontrada para este diploma. Popule a tabela diploma_disciplinas.",
    );
  }

  // 6. Busca atividades complementares
  const { data: atividadesData } = await supabase
    .from("diploma_atividades_complementares")
    .select(
      "codigo, tipo, carga_horaria_relogio, data_inicio, data_fim, descricao",
    )
    .eq("diploma_id", diplomaId);

  const atividades: AtividadeComplementar[] = (atividadesData || []).map(
    (a: any) => ({
      codigo: a.codigo,
      data_inicio: a.data_inicio,
      data_fim: a.data_fim,
      tipo: a.tipo,
      descricao: a.descricao || undefined,
      carga_horaria_relogio: [
        { valor: a.carga_horaria_relogio },
      ] as CargaHorariaRelogioComEtiqueta[],
      docentes_validacao: [],
    }),
  );

  // 7. Busca estágios
  const { data: estagiosData } = await supabase
    .from("diploma_estagios")
    .select(
      "codigo_unidade_curricular, data_inicio, data_fim, concedente_cnpj, concedente_razao_social, carga_horaria_relogio",
    )
    .eq("diploma_id", diplomaId);

  const estagios: Estagio[] = (estagiosData || []).map((e: any) => ({
    codigo_unidade_curricular: e.codigo_unidade_curricular,
    data_inicio: e.data_inicio,
    data_fim: e.data_fim,
    concedente: e.concedente_cnpj
      ? {
          tipo: "PJ" as const,
          razao_social: e.concedente_razao_social,
          cnpj: e.concedente_cnpj,
        }
      : undefined,
    carga_horaria_relogio: [
      { valor: e.carga_horaria_relogio },
    ] as CargaHorariaRelogioComEtiqueta[],
    docentes_orientadores: [],
  }));

  // 8. Busca ENADE
  const { data: enadeData } = await supabase
    .from("diploma_enade")
    .select("situacao, condicao, condicao_nao_habilitado, ano_edicao")
    .eq("diploma_id", diplomaId);

  const enade: EnadeInfo[] = (enadeData || []).map((e: any) => ({
    tipo: (e.situacao || "Habilitado") as
      | "Habilitado"
      | "NaoHabilitado"
      | "Irregular",
    condicao: (e.condicao || "Concluinte") as "Ingressante" | "Concluinte",
    edicao: String(e.ano_edicao || new Date().getFullYear()),
    motivo: e.condicao_nao_habilitado || undefined,
  }));

  // Mantenedora — monta endereço do JSON se existir
  const mantEnd = iesData.mantenedora_endereco as any;
  const mantenedora = iesData.mantenedora_razao_social
    ? {
        razao_social:
          iesData.mantenedora_razao_social || iesData.mantenedora_nome,
        cnpj: iesData.mantenedora_cnpj || iesData.cnpj,
        endereco: montarEndereco(
          mantEnd?.logradouro || iesData.logradouro,
          mantEnd?.numero || iesData.numero,
          mantEnd?.complemento || null,
          mantEnd?.bairro || iesData.bairro,
          mantEnd?.codigo_municipio || iesData.codigo_municipio,
          mantEnd?.municipio || iesData.municipio,
          mantEnd?.uf || iesData.uf,
          mantEnd?.cep || iesData.cep,
        ),
      }
    : undefined;

  const cur = diplomaData.cursos;

  // Bug #G — Atos regulatórios do curso lidos da tabela dedicada `atos_curso`
  // (espelha o padrão da `credenciamentos` do Bug #7). Se a tabela ainda não
  // tiver registros para este curso (curso legado), o helper devolve undefined
  // em cada slot e o fallback abaixo usa os campos planos da `cursos` (deprecados).
  const atosCurso = await buscarAtosCurso(supabase, cur.id);

  // ============================================================
  // Bug #12 — Persistência atômica do timestamp do histórico
  // ============================================================
  // O código de validação do histórico (SHA256, Bug #2) precisa ser reproduzível
  // para auditorias do MEC. Isso só é possível se a data E hora usadas no hash
  // forem persistidas no banco na primeira geração e reutilizadas nas subsequentes.
  //
  // Estratégia (com hardening de race condition via RPC):
  //  1. Se o diploma já tem os 3 campos persistidos → fast path, usa valores
  //     existentes sem chamar a RPC.
  //  2. Caso contrário → calcula candidatos (data/hora em America/Sao_Paulo +
  //     hash SHA256) e chama a função Postgres `persistir_timestamp_historico`,
  //     que faz SELECT FOR UPDATE + UPDATE atômico. A RPC garante que duas
  //     requisições paralelas no mesmo diploma fresh convirjam para o mesmo
  //     tuplo persistido (a perdedora lê o tuplo da vencedora).
  //
  // Por que RPC e não UPDATE condicional? Porque o tuplo (data, hora, código)
  // precisa ser ATÔMICO — não pode haver mistura de data de uma chamada com
  // hora de outra. SELECT FOR UPDATE + UPDATE no mesmo bloco PL/pgSQL garante
  // isso; UPDATE condicional separado em SQL+app code não.
  //
  // Timezone: usamos explicitamente 'America/Sao_Paulo' porque o servidor Vercel
  // roda em UTC — new Date() direto daria DDMMAAAA errado após ~21h BRT.

  let dataEmissaoHistorico: string = diplomaData.data_emissao_historico || "";
  let horaEmissaoHistorico: string = diplomaData.hora_emissao_historico || "";
  let codigoValidacaoHistorico: string =
    diplomaData.codigo_validacao_historico || "";

  const timestampFaltante =
    !dataEmissaoHistorico || !horaEmissaoHistorico || !codigoValidacaoHistorico;

  if (timestampFaltante) {
    // Gera CANDIDATOS (data, hora, código) para enviar à RPC.
    // A RPC decide atomicamente se persiste estes ou retorna o tuplo já existente.
    const { data: dataCandidata, hora: horaCandidata } = gerarDataHoraBrasil();
    const codigoCandidato = gerarCodigoValidacaoHistorico({
      ra: diplomaData.diplomados.ra || "",
      cpf: diplomaData.diplomados.cpf,
      codigoCursoEMEC: cur.codigo_emec || "",
      cnpjEmissora: iesData.cnpj || "",
      codigoMecEmissora: iesData.codigo_mec || "1606",
      dataEmissaoHistorico: dataCandidata,
      horaEmissaoHistorico: horaCandidata,
    });

    // Chama a função RPC `persistir_timestamp_historico` que faz SELECT FOR UPDATE
    // + UPDATE atômico, eliminando race conditions entre requisições paralelas
    // sobre o mesmo diploma. Se outra requisição já persistiu primeiro, a RPC
    // retorna o tuplo dela — garantindo que ambas as requisições gerem o XML
    // com o MESMO hash (reprodutibilidade obrigatória para auditorias MEC).
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      "persistir_timestamp_historico",
      {
        p_diploma_id: diplomaId,
        p_data: dataCandidata,
        p_hora: horaCandidata,
        p_codigo: codigoCandidato,
      },
    );

    if (rpcErr) {
      throw new Error(
        `Falha ao persistir timestamp/código do histórico via RPC: ${rpcErr.message}. ` +
          "Código de validação não pode ser gerado sem persistência — auditoria do MEC exige reprodutibilidade.",
      );
    }

    // RPC retorna SETOF (1 linha) — Supabase devolve como array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as
      | {
          data_emissao_historico: string | null;
          hora_emissao_historico: string | null;
          codigo_validacao_historico: string | null;
        }
      | null
      | undefined;

    if (
      !row ||
      !row.data_emissao_historico ||
      !row.hora_emissao_historico ||
      !row.codigo_validacao_historico
    ) {
      throw new Error(
        "persistir_timestamp_historico: RPC retornou linha inválida ou vazia. " +
          "Esperado tuplo (data, hora, código) — todas não-nulas.",
      );
    }

    dataEmissaoHistorico = row.data_emissao_historico;
    horaEmissaoHistorico = row.hora_emissao_historico;
    codigoValidacaoHistorico = row.codigo_validacao_historico;
  }

  // 9. Monta e retorna objeto completo
  const dadosDiploma: DadosDiploma = {
    diplomado: {
      ra: diplomaData.diplomados.ra || "",
      nome: diplomaData.diplomados.nome,
      nome_social: diplomaData.diplomados.nome_social || undefined,
      sexo: diplomaData.diplomados.sexo as "M" | "F",
      nacionalidade: diplomaData.diplomados.nacionalidade || "Brasileira",
      codigo_municipio_ibge: diplomaData.diplomados.codigo_municipio_ibge || "",
      naturalidade_municipio:
        diplomaData.diplomados.naturalidade_municipio || "",
      naturalidade_uf: diplomaData.diplomados.naturalidade_uf || "",
      cpf: diplomaData.diplomados.cpf,
      data_nascimento: diplomaData.diplomados.data_nascimento,
      rg_numero: diplomaData.diplomados.rg_numero || undefined,
      rg_orgao_expedidor:
        diplomaData.diplomados.rg_orgao_expedidor || undefined,
      rg_uf: diplomaData.diplomados.rg_uf || undefined,
      filiacao: filiacao.length > 0 ? filiacao : undefined,
    },

    curso: {
      nome: cur.nome,
      codigo_emec: cur.codigo_emec,
      modalidade: cur.modalidade === "EAD" ? "EAD" : "Presencial",
      titulo_conferido: cur.titulo_conferido || "Bacharel",
      grau_conferido: cur.grau || "Bacharelado",
      enfase: cur.enfase || undefined,
      endereco: montarEndereco(
        cur.logradouro,
        cur.numero,
        null,
        cur.bairro,
        cur.codigo_municipio,
        cur.municipio,
        cur.uf,
        cur.cep,
      ),
      // Bug #G — fonte primária: tabela `atos_curso`. Fallback para campos
      // planos da `cursos` (deprecados) garante compatibilidade com cursos
      // legados que ainda não foram migrados para a tabela dedicada.
      autorizacao:
        atosCurso.autorizacao ??
        montarAtoRegulatorio(
          cur.tipo_autorizacao,
          cur.numero_autorizacao,
          cur.data_autorizacao,
          cur.veiculo_publicacao_autorizacao,
          cur.data_publicacao_autorizacao,
          cur.secao_publicacao_autorizacao?.toString(),
          cur.pagina_publicacao_autorizacao?.toString(),
          cur.numero_dou_autorizacao,
        ),
      reconhecimento:
        atosCurso.reconhecimento ??
        montarAtoRegulatorio(
          cur.tipo_reconhecimento,
          cur.numero_reconhecimento,
          cur.data_reconhecimento,
          cur.veiculo_publicacao_reconhecimento,
          cur.data_publicacao_reconhecimento,
          cur.secao_publicacao_reconhecimento?.toString(),
          cur.pagina_publicacao_reconhecimento?.toString(),
          cur.numero_dou_reconhecimento,
        ),
      renovacao_reconhecimento:
        atosCurso.renovacao_reconhecimento ??
        (cur.tipo_renovacao
          ? montarAtoRegulatorio(
              cur.tipo_renovacao,
              cur.numero_renovacao,
              cur.data_renovacao,
              cur.veiculo_publicacao_renovacao,
              cur.data_publicacao_renovacao,
              cur.secao_publicacao_renovacao?.toString(),
              cur.pagina_publicacao_renovacao?.toString(),
              cur.numero_dou_renovacao,
            )
          : undefined),
    },

    ies: {
      nome: iesData.nome,
      codigo_mec: iesData.codigo_mec,
      cnpj: iesData.cnpj,
      endereco: montarEndereco(
        iesData.logradouro,
        iesData.numero,
        iesData.complemento,
        iesData.bairro,
        iesData.codigo_municipio,
        iesData.municipio,
        iesData.uf,
        iesData.cep,
      ),
      // Atos regulatórios lidos da tabela dedicada `credenciamentos` (Bug #7)
      credenciamento: atosIES.credenciamento,
      recredenciamento: atosIES.recredenciamento,
      // renovacao_recredenciamento: NÃO usado pela FIC — conforme regra de negócio
      // o XSD v1.05 permite esse elemento mas operacionalmente a FIC só tem
      // Credenciamento + Recredenciamentos múltiplos (o mais recente vai em <Recredenciamento>).
      mantenedora,
    },

    diploma: {
      id: diplomaData.id,
      // ATENÇÃO: codigo_validacao do DIPLOMA é gerado pela REGISTRADORA (não pela emissora).
      // Enquanto a integração com a registradora não está pronta, mantemos o valor atual
      // do banco ou string vazia — a registradora preencherá. NÃO geramos um código aleatório
      // aqui (isso era o bug antigo que gerava valores inválidos tipo '1606.a7aa1732a573').
      codigo_validacao: diplomaData.codigo_validacao || "",
      data_colacao_grau: diplomaData.data_colacao_grau,
      data_conclusao: diplomaData.data_conclusao,
      // Bug #E — fix 2026-04-07 (Onda 2 / Caminho C):
      // `data_expedicao` foi removido do tipo DadosDiploma. A FIC nunca
      // escreve DataExpedicaoDiploma no XML do diploma — esse campo é
      // exclusivo da registradora (TLivroRegistro). No histórico, é
      // derivado automaticamente em historico.builder.ts.
      segunda_via: diplomaData.segunda_via || false,
      // Bug #1 — fix 2026-04-07 (Onda 1):
      // Em produção, força sempre "producao" (única opção com validade legal
      // per IN 05 §2.2.2.3). Em dev/staging, respeita o valor do banco para
      // permitir testes com Homologação/Teste.
      // NOTA: process.env.NODE_ENV é convenção Node.js — SEMPRE em inglês
      // ('development' | 'production' | 'test'). Não confundir com o enum
      // interno do banco diploma_diplomas.ambiente que está em pt-BR
      // ('producao' | 'homologacao' | 'teste').
      ambiente:
        process.env.NODE_ENV === "production"
          ? "producao"
          : (diplomaData.ambiente as
              | "producao"
              | "homologacao"
              | "teste"
              | undefined) || "producao",
    },

    historico: {
      codigo_curriculo:
        diplomaData.codigo_curriculo || cur.codigo_curso || "001",
      // Código persistido — gerado uma única vez via SHA256 Anexo III (ver bloco acima)
      codigo_validacao_historico: codigoValidacaoHistorico,
      data_emissao: dataEmissaoHistorico,
      hora_emissao: horaEmissaoHistorico,
      carga_horaria_curso: cur.carga_horaria_total || 0,
      carga_horaria_integralizada:
        diplomaData.carga_horaria_integralizada || cur.carga_horaria_total || 0,
      tipo_carga_horaria: "HoraRelogio",
      data_ingresso: diplomaData.data_ingresso || "",
      forma_acesso: mapearFormaAcesso(diplomaData.forma_acesso),
      situacao_discente: {
        tipo: "Formado",
        data_conclusao: diplomaData.data_conclusao,
        data_colacao_grau: diplomaData.data_colacao_grau,
        // Bug #E — DataExpedicaoDiploma é derivada automaticamente pelo
        // builder via gerarDataExpedicaoXML() (data atual SP). NÃO passar
        // aqui — o tipo TypeScript bloqueia.
      },
      disciplinas,
      atividades_complementares: atividades.length > 0 ? atividades : undefined,
      estagios: estagios.length > 0 ? estagios : undefined,
      enade,
    },

    // IES Registradora — montada a partir dos campos do diploma
    ies_registradora: diplomaData.registradora_cnpj
      ? {
          nome: diplomaData.registradora_nome || "",
          codigo_mec: diplomaData.registradora_codigo_mec || "",
          cnpj: diplomaData.registradora_cnpj,
        }
      : undefined,

    assinantes,
  };

  // ============================================================
  // Fase 2 do Snapshot Imutável (2026-04-22)
  // ============================================================
  //
  // Se o diploma tem snapshot (criado pela Fase 1), sobrescreve os campos
  // que vêm da extração (diplomado, curso básico, disciplinas, atividades,
  // estágios, ingresso, assinantes) com os valores do snapshot —
  // garantindo que os XMLs refletem EXATAMENTE os dados consolidados
  // na extração confirmada, independente do que está nas tabelas
  // normalizadas (que podem ter sido editadas).
  //
  // Dados institucionais (IES emissora, atos regulatórios, códigos e-MEC,
  // códigos IBGE, filiação, ENADE) continuam vindo das tabelas — não são
  // dados extraídos do diploma individual.
  //
  // Diplomas legados (sem snapshot) → helper é no-op, fluxo atual intocado.
  const snapshotRaw =
    (diplomaData as { dados_snapshot_extracao?: unknown })
      .dados_snapshot_extracao ?? null;
  const snapshot = snapshotRaw as DadosSnapshot | null;
  const dadosDiplomaFinal = aplicarSnapshotSobreDadosDiploma(
    dadosDiploma,
    snapshot,
  );

  // ── Validação de regras de NEGÓCIO (Bug #H — princípio do override humano) ──
  // Estas regras são SEMÂNTICAS (próprias da FIC), não estruturais (XSD).
  // Quando uma regra é violada, lançamos ValidacaoNegocioError que o route
  // handler captura e devolve como 422 com payload estruturado para o
  // frontend exibir um modal com justificativa obrigatória. Após o operador
  // confirmar, o route re-chama este montador passando `pular_regras_negocio`
  // com o código da regra que foi sobrescrita, e grava o registro em
  // `validacao_overrides` para auditoria.
  //
  // IMPORTANTE: NUNCA inclua aqui validações que dependem do XSD obrigatório
  // (minOccurs, enum, tipo). Essas são responsabilidade do `validador.ts`
  // e não podem ser sobrescritas — o XML não passaria na registradora.
  const { avaliarRegrasNegocio, ValidacaoNegocioError } =
    await import("./validation/regras-negocio");
  const violacoes = avaliarRegrasNegocio(
    dadosDiplomaFinal,
    options.pular_regras_negocio ?? [],
  );
  if (violacoes.length > 0) {
    throw new ValidacaoNegocioError(violacoes);
  }

  return dadosDiplomaFinal;
}
