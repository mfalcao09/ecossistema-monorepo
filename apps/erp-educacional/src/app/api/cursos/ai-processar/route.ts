import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouter, callOpenRouterImage } from '@/lib/ai/openrouter'
import { verificarAuth } from '@/lib/security/api-guard'
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from '@/lib/security/rate-limit'

// ─── Schema completo de campos ────────────────────────────────────────────────
const CAMPOS_SCHEMA = `
CAMPOS DISPONÍVEIS NA TABELA DE CURSOS (use exatamente estes nomes):
nome, codigo_emec, grau (bacharel|licenciado|tecnologo|especialista|mestre|doutor),
titulo_conferido, descricao_habilitacao, descricao_oficial,
modalidade (presencial|ead|hibrido),
carga_horaria_total (int), carga_horaria_hora_relogio (int), carga_horaria_integralizada (int),
carga_horaria_estagio (int), carga_horaria_atividades_complementares (int), carga_horaria_tcc (int),
numero_processo_emec, tipo_processo_emec, data_processo_emec (YYYY-MM-DD),
tipo_autorizacao, numero_autorizacao, data_autorizacao (YYYY-MM-DD),
veiculo_publicacao_autorizacao, data_publicacao_autorizacao (YYYY-MM-DD),
secao_publicacao_autorizacao (int), pagina_publicacao_autorizacao (int), numero_dou_autorizacao,
tipo_reconhecimento, numero_reconhecimento, data_reconhecimento (YYYY-MM-DD),
veiculo_publicacao_reconhecimento, data_publicacao_reconhecimento (YYYY-MM-DD),
secao_publicacao_reconhecimento (int), pagina_publicacao_reconhecimento (int), numero_dou_reconhecimento,
tipo_renovacao, numero_renovacao, data_renovacao (YYYY-MM-DD),
data_publicacao_renovacao (YYYY-MM-DD), veiculo_publicacao_renovacao,
secao_publicacao_renovacao (int), pagina_publicacao_renovacao (int), numero_dou_renovacao,
unidade_certificadora (boolean),
logradouro, numero, bairro, municipio, codigo_municipio, uf (2 letras), cep (só números),
coordenador_nome, coordenador_email, coordenador_telefone,
vagas_autorizadas (int), periodicidade (semestral|anual|trimestral),
situacao_emec (em_atividade|extinto|suspenso|em_extincao),
data_inicio_funcionamento (YYYY-MM-DD),
conceito_curso (int 1-5), ano_cc (int), cpc_faixa (int), cpc_continuo (decimal), cpc_ano (int),
enade_conceito (int 1-5), enade_ano (int),
cine_area_geral, cine_rotulo, codigo_grau_mec, codigo_habilitacao_mec,
objetivo_curso, periodo_divisao_turmas,
numero_etapas (int), duracao_hora_aula_minutos (int), dias_letivos (int), relevancia (int), enfase
`;

const PROMPT_EXTRACAO = (fonte: string) => `Você é um especialista em dados acadêmicos de IES brasileiras.

Analise o conteúdo abaixo (fonte: ${fonte}) e extraia TODOS os cursos encontrados.

${CAMPOS_SCHEMA}

Para cada dado encontrado que NÃO tem campo correspondente na lista acima, coloque em "_dados_extras" como objeto chave-valor.

Retorne APENAS JSON válido:
{
  "cursos": [
    {
      "nome": "...",
      "codigo_emec": "...",
      ... (apenas campos com valor claramente identificado) ...,
      "_dados_extras": { "campo_sem_mapeamento": "valor" },
      "_fonte": "${fonte}",
      "_confianca": "alta|media|baixa"
    }
  ],
  "duvidas": ["Dúvida 1 sobre interpretação dos dados", "..."],
  "observacoes": "observação geral sobre a extração"
}

Regras:
- Inclua apenas campos com valor claramente identificado
- Datas em YYYY-MM-DD; números como números, não texto
- Se o mesmo dado aparecer de formas diferentes (ex: modalidade "semi-presencial"), indique em _dados_extras
- _confianca: "alta" = certeza total, "media" = provável mas pode haver dúvida, "baixa" = inferido
- Identifique TODOS os cursos presentes, mesmo com poucos dados`;

// ─── Extração de texto/base64 por tipo de arquivo ────────────────────────────
async function extrairConteudo(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): Promise<{ tipo: "texto" | "imagem"; conteudo: string; mediaType?: string }> {
  const imageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

  if (imageTypes.includes(mimeType) || mimeType === "application/pdf") {
    const base64 = Buffer.from(bytes).toString("base64");
    const mt = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
    return { tipo: "imagem", conteudo: base64, mediaType: mt };
  }

  // Texto
  let texto: string;
  try {
    texto = new TextDecoder("utf-8").decode(bytes);
  } catch {
    texto = Buffer.from(bytes).toString("latin1");
  }
  if (texto.length > 60000) texto = texto.substring(0, 60000) + "\n...[truncado]";
  return { tipo: "texto", conteudo: texto };
}

// ─── Chama IA para extrair cursos de um arquivo ───────────────────────────────
async function extrairCursosDoArquivo(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
  instrucaoUsuario?: string
): Promise<{ cursos: Record<string, unknown>[]; duvidas: string[]; observacoes: string }> {
  const { tipo, conteudo, mediaType } = await extrairConteudo(bytes, fileName, mimeType);

  // Bloco de instrução do usuário (orientação para corrigir extração)
  const blocoInstrucao = instrucaoUsuario
    ? `\n\n⚠️ ORIENTAÇÃO DO USUÁRIO (leve em consideração ao extrair):\n${instrucaoUsuario}`
    : "";

  let rawText: string;
  if (tipo === "imagem") {
    rawText = await callOpenRouterImage(
      conteudo,
      mediaType!,
      PROMPT_EXTRACAO(fileName) + blocoInstrucao,
      { modulo: "cadastro", funcionalidade: "extracao_cursos", maxTokens: 8192 }
    );
  } else {
    rawText = await callOpenRouter(
      [{ role: "user", content: `${PROMPT_EXTRACAO(fileName)}${blocoInstrucao}\n\nCONTEÚDO:\n\`\`\`\n${conteudo}\n\`\`\`` }],
      { modulo: "cadastro", funcionalidade: "extracao_cursos", maxTokens: 8192 }
    );
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { cursos: [], duvidas: [], observacoes: `Não foi possível extrair dados de ${fileName}` };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      cursos: Array.isArray(parsed.cursos) ? parsed.cursos : [],
      duvidas: Array.isArray(parsed.duvidas) ? parsed.duvidas : [],
      observacoes: parsed.observacoes ?? "",
    };
  } catch {
    return { cursos: [], duvidas: [], observacoes: `Erro ao parsear dados de ${fileName}` };
  }
}

// ─── Análise cruzada entre múltiplas fontes ───────────────────────────────────
async function analisarCruzado(
  todosOsCursos: Array<{ curso: Record<string, unknown>; fonte: string }>
): Promise<{
  resultado: CursoAnalisado[];
  duvidas_gerais: string[];
}> {
  // Agrupa por identificador (codigo_emec ou nome normalizado)
  const grupos = new Map<string, Array<{ curso: Record<string, unknown>; fonte: string }>>();

  for (const item of todosOsCursos) {
    const chave = String(item.curso.codigo_emec || "").trim() ||
                  String(item.curso.nome || "").toLowerCase().trim().replace(/\s+/g, "_");
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(item);
  }

  const resultado: CursoAnalisado[] = [];

  for (const [, itens] of Array.from(grupos)) {
    // Mescla dados de todas as fontes
    const dadosMesclados: Record<string, unknown> = {};
    const divergencias: Divergencia[] = [];
    const dadosExtras: Record<string, string[]> = {};

    // Campos internos a ignorar
    const camposIgnorar = new Set(["_fonte", "_confianca", "_dados_extras"]);

    // Coleta todos os campos de todas as fontes
    const todosCampos = new Set<string>();
    for (const item of itens) {
      for (const k of Object.keys(item.curso)) {
        if (!camposIgnorar.has(k)) todosCampos.add(k);
      }
      // Dados extras
      const extras = item.curso._dados_extras as Record<string, unknown> | undefined;
      if (extras) {
        for (const [k, v] of Object.entries(extras)) {
          if (!dadosExtras[k]) dadosExtras[k] = [];
          dadosExtras[k].push(`${String(v)} (${item.fonte})`);
        }
      }
    }

    // Para cada campo, compara valores entre fontes
    for (const campo of Array.from(todosCampos)) {
      const valoresPorFonte: Array<{ valor: unknown; fonte: string; confianca: string }> = [];

      for (const item of itens) {
        const valor = item.curso[campo];
        if (valor !== undefined && valor !== null && valor !== "") {
          valoresPorFonte.push({
            valor,
            fonte: item.fonte,
            confianca: String(item.curso._confianca || "media"),
          });
        }
      }

      if (valoresPorFonte.length === 0) continue;

      // Verifica divergência
      const valoresUnicos = Array.from(new Set(valoresPorFonte.map((v) => String(v.valor).trim().toLowerCase())));

      if (valoresUnicos.length > 1) {
        // Há divergência — registra
        divergencias.push({
          campo,
          valores: valoresPorFonte.map((v) => ({ valor: v.valor, fonte: v.fonte, confianca: v.confianca })),
          valor_sugerido: valoresPorFonte.find((v) => v.confianca === "alta")?.valor ??
                          valoresPorFonte[0].valor,
          aprovado: false,
        });
        // Por enquanto usa o primeiro valor
        dadosMesclados[campo] = valoresPorFonte[0].valor;
      } else {
        // Consenso
        dadosMesclados[campo] = valoresPorFonte[0].valor;
      }
    }

    // Identifica campos ausentes importantes
    const CAMPOS_IMPORTANTES = [
      "nome", "codigo_emec", "grau", "titulo_conferido", "modalidade", "carga_horaria_total",
      "numero_reconhecimento", "data_reconhecimento", "municipio", "uf", "situacao_emec",
    ];
    const camposAusentes = CAMPOS_IMPORTANTES.filter(
      (c) => !dadosMesclados[c] || dadosMesclados[c] === ""
    );

    resultado.push({
      dados: dadosMesclados,
      fontes: itens.map((item2) => item2.fonte),
      divergencias,
      campos_ausentes: camposAusentes,
      dados_extras: dadosExtras,
      _acao: "pendente",
      _selecionado: true,
    });
  }

  return { resultado, duvidas_gerais: [] };
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface Divergencia {
  campo: string;
  valores: Array<{ valor: unknown; fonte: string; confianca: string }>;
  valor_sugerido: unknown;
  aprovado: boolean;
}

interface CursoAnalisado {
  dados: Record<string, unknown>;
  fontes: string[];
  divergencias: Divergencia[];
  campos_ausentes: string[];
  dados_extras: Record<string, string[]>;
  _acao: "pendente" | "criar" | "atualizar" | "ignorar";
  _selecionado: boolean;
  _match?: { id: string; nome: string } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST — processa múltiplos arquivos e retorna relatório de análise cruzada
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  // Rate limit: 5 per minute for AI processing
  const rateLimit = await verificarRateLimitERP(request, 'ia_chat', auth.userId)
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429 }
    )
    adicionarHeadersRetryAfter(response.headers, rateLimit)
    return response
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const instituicaoId = formData.get('instituicao_id') as string | null
    const instrucaoUsuario = (formData.get('instrucao_usuario') as string | null) ?? undefined

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const errosArquivos: string[] = [];
    const todosOsCursos: Array<{ curso: Record<string, unknown>; fonte: string }> = [];
    const todasDuvidas: string[] = [];
    const todasObservacoes: string[] = [];

    // Processa cada arquivo em lotes de 5 (máximo 25 arquivos)
    const arquivosParaProcessar = files.slice(0, 25);
    const BATCH_SIZE = 5;
    const resultados: PromiseSettledResult<{ result: Awaited<ReturnType<typeof extrairCursosDoArquivo>>; nome: string }>[] = [];
    for (let i = 0; i < arquivosParaProcessar.length; i += BATCH_SIZE) {
      const lote = arquivosParaProcessar.slice(i, i + BATCH_SIZE);
      const loteResultados = await Promise.allSettled(
        lote.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          return { result: await extrairCursosDoArquivo(bytes, file.name, file.type, instrucaoUsuario), nome: file.name };
        })
      );
      resultados.push(...loteResultados);
    }

    for (const r of resultados) {
      if (r.status === "fulfilled") {
        const { result, nome } = r.value;
        for (const curso of result.cursos) {
          todosOsCursos.push({ curso, fonte: nome });
        }
        todasDuvidas.push(...result.duvidas);
        if (result.observacoes) todasObservacoes.push(`[${nome}]: ${result.observacoes}`);
      } else {
        errosArquivos.push(`Erro ao processar arquivo: ${r.reason}`);
      }
    }

    if (todosOsCursos.length === 0) {
      return NextResponse.json({
        error: "Nenhum curso identificado nos arquivos enviados.",
        erros: errosArquivos,
        observacoes: todasObservacoes,
      }, { status: 422 });
    }

    // Análise cruzada entre fontes
    const { resultado: cursosAnalisados, duvidas_gerais } = await analisarCruzado(todosOsCursos);

    // Cruza com cursos existentes no banco
    const supabase = await createClient();
    let query = supabase.from("cursos").select("id, nome, codigo_emec").eq("ativo", true);
    if (instituicaoId) query = query.eq("instituicao_id", instituicaoId);
    const { data: cursosExistentes } = await query;

    // Determina ação para cada curso
    for (const analisado of cursosAnalisados) {
      const nomeNorm = String(analisado.dados.nome || "").toLowerCase().trim();
      const codigoEmec = String(analisado.dados.codigo_emec || "").trim();

      const match = cursosExistentes?.find((existente) => {
        if (codigoEmec && existente.codigo_emec === codigoEmec) return true;
        const nomeEx = (existente.nome || "").toLowerCase().trim();
        return nomeEx === nomeNorm || nomeEx.includes(nomeNorm) || nomeNorm.includes(nomeEx);
      });

      analisado._match = match ? { id: match.id, nome: match.nome } : null;
      analisado._acao = match ? "atualizar" : "criar";
    }

    const totalDivergencias = cursosAnalisados.reduce((acc, c) => acc + c.divergencias.length, 0);
    const totalCamposExtras = cursosAnalisados.reduce(
      (acc, c) => acc + Object.keys(c.dados_extras).length, 0
    );

    const response = NextResponse.json({
      success: true,
      cursos: cursosAnalisados,
      total: cursosAnalisados.length,
      para_criar: cursosAnalisados.filter((c) => c._acao === "criar").length,
      para_atualizar: cursosAnalisados.filter((c) => c._acao === "atualizar").length,
      total_divergencias: totalDivergencias,
      total_campos_extras: totalCamposExtras,
      duvidas: Array.from(new Set([...todasDuvidas, ...duvidas_gerais])).slice(0, 10),
      observacoes: todasObservacoes,
      erros_arquivos: errosArquivos,
    });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;

  } catch (error) {
    console.error("Erro no agente IA:", error);
    const mensagem = error instanceof Error ? error.message : String(error);
    const isConfigError = mensagem.includes("não configurada") || mensagem.includes("OpenRouter");
    const response = NextResponse.json({
      error: isConfigError ? "Serviço de IA não disponível" : "Erro interno do servidor",
      detalhe: isConfigError ? mensagem : undefined,
    }, { status: isConfigError ? 503 : 500 });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT — salva cursos aprovados pelo usuário
// ═══════════════════════════════════════════════════════════════════════════════
export async function PUT(request: NextRequest) {
  try {
    const { cursos, instituicao_id } = await request.json();

    if (!cursos || !Array.isArray(cursos) || cursos.length === 0) {
      return NextResponse.json({ error: "Nenhum curso para salvar" }, { status: 400 });
    }

    const supabase = await createClient();
    const resultados: Array<{ nome: string; acao: string; id?: string; erro?: string }> = [];

    for (const item of cursos) {
      if (!item._selecionado || item._acao === "ignorar") continue;

      // Remove campos internos e monta objeto limpo
      const dados = item.dados as Record<string, unknown>;
      const dadosLimpos: Record<string, unknown> = {};
      const CAMPOS_INTERNOS = new Set(["_acao", "_selecionado", "_match", "_fonte", "_confianca", "_dados_extras"]);

      for (const [k, v] of Object.entries(dados)) {
        if (!CAMPOS_INTERNOS.has(k) && v !== "" && v !== undefined && v !== null) {
          dadosLimpos[k] = v;
        }
      }

      if (item._acao === "atualizar" && item._match?.id) {
        const { data, error } = await supabase
          .from("cursos")
          .update({ ...dadosLimpos, updated_at: new Date().toISOString() })
          .eq("id", item._match.id)
          .select("id, nome")
          .single();
        resultados.push({
          nome: String(dadosLimpos.nome || item._match.nome),
          acao: "atualizado",
          id: data?.id,
          erro: error?.message,
        });
      } else if (item._acao === "criar") {
        const { data, error } = await supabase
          .from("cursos")
          .insert({
            ...dadosLimpos,
            instituicao_id: instituicao_id || dadosLimpos.instituicao_id,
            ativo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id, nome")
          .single();
        resultados.push({
          nome: String(dadosLimpos.nome || ""),
          acao: "criado",
          id: data?.id,
          erro: error?.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      resultados,
      sucesso: resultados.filter((r) => !r.erro).length,
      erros: resultados.filter((r) => r.erro).length,
    });
  } catch (error) {
    console.error("Erro ao salvar cursos:", error);
    return NextResponse.json({
      error: "Erro interno do servidor",
    }, { status: 500 });
  }
}
