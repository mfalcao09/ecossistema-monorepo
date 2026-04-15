/**
 * Copilot IA Agentic — Edge Function v21
 *
 * Assistente IA contextual com tool-use (agentic mode).
 * Migrado de Lovable Gateway → OpenRouter (Gemini 2.0 Flash).
 *
 * 12 módulos de ações (38 tools):
 *   1. Contratos — criar, buscar, transição de status, pré-preencher formulário
 *   2. Obrigações — listar vencidas, criar alertas
 *   3. Notificações — criar, listar não-lidas
 *   4. Criação Conversacional — create_contract (direto) + prefill_contract_form (formulário)
 *   5. Parcelamento de Solo — projetos, financeiro, cenários, premissas, conformidade legal
 *   6. Parcelamento Execute — simulate, update premises, predict viability, compare, red flags
 *   7. Regulações Brasil — ITBI, Outorga Onerosa, Lei do Verde, Validação CNPJ/SPE
 *   8. Benchmarks de Mercado — SINAPI, SECOVI, ABRAINC
 *   9. Censo IBGE — Renda por setor censitário, demografia, domicílios
 *  10. Embargos Ambientais — IBAMA embargos, ICMBio UCs
 *  11. Exportação DXF — Pré-projeto urbanístico AutoCAD
 *  12. MapBiomas — Uso e cobertura do solo via GEE (histórico 10 anos)
 *
 * Sessão 53 — Fase 1 Item #1: Copilot Agentic Mode
 * Sessão 62 — F2 Item #5: Conversational Contract Creation
 * Sessão 139 — Bloco G Sprint 1: 6 tools parcelamento query + suggest_score_improvements
 * Sessão 140 — Bloco G Sprint 2: US-102 execute actions, US-106 predict, US-108 compare, US-109 red flags
 * Sessão 141 — Bloco H Sprint 1: US-127 ITBI, US-128 Outorga, US-129 Lei do Verde, US-132 CNPJ/SPE
 * Sessão 143 — Bloco H Sprint 3: US-124 Censo IBGE, US-126 Embargos IBAMA/ICMBio, US-131 Pré-projeto DXF
 * Pair programming Claudinho + Buchecha
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEV_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, " +
      "x-supabase-client-platform, x-supabase-client-platform-version, " +
      "x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Tool Definitions (OpenRouter function calling)
// ============================================================

const TOOLS = [
  // ─── Contratos ───
  {
    type: "function",
    function: {
      name: "search_contracts",
      description: "Busca contratos por filtros. Retorna lista resumida com id, tipo, status, valor, datas, nome do imóvel e partes.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filtrar por status do contrato (ex: ativo, rascunho, em_aprovacao, encerrado, cancelado, expirado, etc.)" },
          contract_type: { type: "string", description: "Tipo do contrato (locacao, venda, administracao)" },
          expiring_within_days: { type: "number", description: "Buscar contratos vencendo nos próximos N dias" },
          limit: { type: "number", description: "Máximo de resultados (default 10, max 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contract_details",
      description: "Retorna detalhes completos de um contrato específico, incluindo partes, obrigações e parcelas.",
      parameters: {
        type: "object",
        properties: {
          contract_id: { type: "string", description: "UUID do contrato" },
        },
        required: ["contract_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transition_contract_status",
      description: "Altera o status de um contrato. Requer confirmação do usuário. Exemplo: mover de 'rascunho' para 'em_revisao'.",
      parameters: {
        type: "object",
        properties: {
          contract_id: { type: "string", description: "UUID do contrato" },
          to_status: { type: "string", description: "Novo status desejado" },
        },
        required: ["contract_id", "to_status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contract_summary",
      description: "Retorna um resumo geral do portfólio de contratos: total por status, valor total, contratos expirando em breve.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  // ─── Criação Conversacional de Contratos ───
  {
    type: "function",
    function: {
      name: "create_contract",
      description: `Cria um contrato diretamente no banco de dados. Use SOMENTE após coletar todos os dados obrigatórios via conversa e receber confirmação explícita do usuário.
Campos obrigatórios: contract_type, start_date, end_date, monthly_value (locação) ou total_value (venda).
Campos recomendados: property_id, adjustment_index (locação), guarantee_type.
As partes (locatário, proprietário, fiador) devem ser vinculadas via person_id existente ou nome para busca.`,
      parameters: {
        type: "object",
        properties: {
          contract_type: { type: "string", enum: ["locacao", "venda", "administracao", "distrato"], description: "Tipo do contrato" },
          status: { type: "string", enum: ["rascunho", "negociacao", "ativo"], description: "Status inicial (default: rascunho)" },
          start_date: { type: "string", description: "Data de início (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Data de término (YYYY-MM-DD)" },
          monthly_value: { type: "number", description: "Valor mensal do aluguel (R$)" },
          total_value: { type: "number", description: "Valor total do contrato (R$)" },
          property_id: { type: "string", description: "UUID do imóvel. Se não informado, buscar por nome/endereço" },
          property_search: { type: "string", description: "Nome ou endereço do imóvel para busca (se property_id não fornecido)" },
          adjustment_index: { type: "string", enum: ["IGP-M", "IPCA", "INPC", "IGP-DI", "Outro"], description: "Índice de reajuste" },
          guarantee_type: { type: "string", description: "Tipo de garantia (caução, fiança, seguro_fianca, titulo_capitalizacao, sem_garantia)" },
          guarantee_value: { type: "number", description: "Valor da garantia (R$)" },
          payment_due_day: { type: "number", description: "Dia de vencimento (1-31)" },
          notes: { type: "string", description: "Observações do contrato" },
          parties: {
            type: "array",
            description: "Partes do contrato. Cada item com person_id (UUID) OU person_search (nome para busca) e role",
            items: {
              type: "object",
              properties: {
                person_id: { type: "string", description: "UUID da pessoa (se conhecido)" },
                person_search: { type: "string", description: "Nome da pessoa para buscar no banco" },
                role: { type: "string", enum: ["locatario", "locador", "comprador", "vendedor", "proprietario", "fiador", "administrador", "testemunha", "intermediador"], description: "Papel no contrato" },
              },
              required: ["role"],
            },
          },
        },
        required: ["contract_type", "start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prefill_contract_form",
      description: `Prepara dados coletados na conversa para pré-preencher o formulário de criação de contrato. Use quando o usuário preferir revisar e editar os dados no formulário visual antes de salvar. Retorna um JSON estruturado que o frontend usa para abrir o formulário pré-preenchido.`,
      parameters: {
        type: "object",
        properties: {
          contract_type: { type: "string", enum: ["locacao", "venda", "administracao", "distrato"], description: "Tipo do contrato" },
          start_date: { type: "string", description: "Data de início (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Data de término (YYYY-MM-DD)" },
          monthly_value: { type: "number", description: "Valor mensal do aluguel (R$)" },
          total_value: { type: "number", description: "Valor total do contrato (R$)" },
          property_id: { type: "string", description: "UUID do imóvel" },
          property_search: { type: "string", description: "Nome ou endereço do imóvel para busca" },
          adjustment_index: { type: "string", description: "Índice de reajuste" },
          guarantee_type: { type: "string", description: "Tipo de garantia" },
          guarantee_value: { type: "number", description: "Valor da garantia (R$)" },
          payment_due_day: { type: "number", description: "Dia de vencimento (1-31)" },
          notes: { type: "string", description: "Observações" },
          parties: {
            type: "array",
            description: "Partes do contrato",
            items: {
              type: "object",
              properties: {
                person_id: { type: "string" },
                person_search: { type: "string" },
                role: { type: "string" },
              },
              required: ["role"],
            },
          },
        },
        required: ["contract_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "Busca imóveis cadastrados por nome, endereço, bairro ou cidade. Retorna id, nome, endereço, tipo e status.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Termo de busca (nome, endereço, bairro, cidade)" },
          limit: { type: "number", description: "Máximo de resultados (default 5)" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_people",
      description: "Busca pessoas cadastradas por nome, CPF/CNPJ ou email. Retorna id, nome, CPF/CNPJ, tipo, email e telefone.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Termo de busca (nome, CPF/CNPJ, email)" },
          limit: { type: "number", description: "Máximo de resultados (default 5)" },
        },
        required: ["search"],
      },
    },
  },
  // ─── Obrigações ───
  {
    type: "function",
    function: {
      name: "list_overdue_obligations",
      description: "Lista obrigações contratuais vencidas (past due). Retorna título, contrato, data de vencimento, tipo.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de resultados (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_obligations",
      description: "Lista obrigações contratuais próximas de vencer nos próximos N dias.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Buscar obrigações vencendo nos próximos N dias (default 30)" },
          limit: { type: "number", description: "Máximo de resultados (default 10)" },
        },
        required: [],
      },
    },
  },
  // ─── Notificações ───
  {
    type: "function",
    function: {
      name: "list_unread_notifications",
      description: "Lista notificações não-lidas do usuário atual. Retorna título, mensagem, categoria, data.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de resultados (default 10)" },
          category: { type: "string", description: "Filtrar por categoria (sistema, contrato, cobranca, aprovacao, vencimento, alerta, ia)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_notification",
      description: "Cria uma notificação para o usuário atual. Use para criar lembretes ou alertas personalizados.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da notificação" },
          message: { type: "string", description: "Mensagem da notificação" },
          category: { type: "string", enum: ["sistema", "contrato", "cobranca", "aprovacao", "vencimento", "alerta", "ia"], description: "Categoria" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Prioridade (default: medium)" },
        },
        required: ["title", "message"],
      },
    },
  },
  // ─── Parcelamento de Solo ───
  {
    type: "function",
    function: {
      name: "list_parcelamento_projects",
      description: "Lista todos os projetos de parcelamento de solo (loteamentos/horizontais) do usuário com status, VGV estimado, total de lotes e localização.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filtrar por status (planejamento, aprovacao, em_obras, concluido, cancelado)" },
          limit: { type: "number", description: "Máximo de resultados (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_parcelamento_financial",
      description: "Retorna os KPIs financeiros de um projeto de parcelamento: VPL, TIR, payback, VGV, custos, fluxo de caixa, performance score, break-even. Requer o ID do projeto.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto de parcelamento" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_parcelamento_scenarios",
      description: "Lista os cenários financeiros de um projeto de parcelamento, incluindo premissas e indicadores de cada cenário. Útil para comparar cenários.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto de parcelamento" },
          limit: { type: "number", description: "Máximo de cenários (default 5)" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_deep_premises",
      description: "Retorna as premissas profundas (detalhadas) de um cenário específico: premissas de projeto, vendas, terreno e custos (infraestrutura, sistema viário, terraplanagem). Útil para entender os inputs da simulação.",
      parameters: {
        type: "object",
        properties: {
          scenario_id: { type: "string", description: "UUID do cenário financeiro" },
        },
        required: ["scenario_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_parcelamento_compliance",
      description: "Retorna o status de conformidade legal de um projeto de parcelamento: score de compliance (0-100), checklist Lei 6.766, checklist Lei 4.591, parecer jurídico, itens pendentes.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto de parcelamento" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_score_improvements",
      description: "Analisa os indicadores financeiros de um projeto de parcelamento e sugere 3 melhorias concretas para aumentar o Performance Score. Identifica os pontos fracos (VPL, TIR, payback, margem, break-even) e propõe ajustes nas premissas.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto de parcelamento" },
        },
        required: ["project_id"],
      },
    },
  },
  // ─── US-102: Execute Actions (simulate + update premises) ───
  {
    type: "function",
    function: {
      name: "simulate_parcelamento",
      description: `Executa uma simulação financeira completa para um cenário de parcelamento. Chama a Edge Function de cálculo financeiro que recalcula VPL, TIR, payback, margem, performance score e fluxo de caixa. Use SOMENTE após confirmação do usuário. Retorna KPIs antes vs depois para mostrar o impacto.`,
      parameters: {
        type: "object",
        properties: {
          scenario_id: { type: "string", description: "UUID do cenário a simular" },
          scenario_type: { type: "string", enum: ["otimista", "realista", "pessimista"], description: "Tipo de cenário (default: realista)" },
        },
        required: ["scenario_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_parcelamento_premises",
      description: `Atualiza premissas de um cenário de parcelamento. Use quando o usuário pedir para "mudar o preço", "alterar o número de lotes", "ajustar prazo de vendas", etc. SEMPRE peça confirmação antes de executar. Após a atualização, ofereça rodar a simulação para ver o impacto.
Campos atualizáveis: qtd_lotes, preco_medio_lote, custo_infra_por_lote, custo_terreno, taxa_desconto_mensal, prazo_vendas_meses, prazo_obras_meses, scenario_name.`,
      parameters: {
        type: "object",
        properties: {
          scenario_id: { type: "string", description: "UUID do cenário" },
          updates: {
            type: "object",
            description: "Campos a atualizar. Ex: { \"preco_medio_lote\": 250000, \"prazo_vendas_meses\": 36 }",
            properties: {
              qtd_lotes: { type: "number", description: "Quantidade de lotes" },
              preco_medio_lote: { type: "number", description: "Preço médio do lote (R$)" },
              custo_infra_por_lote: { type: "number", description: "Custo de infraestrutura por lote (R$)" },
              custo_terreno: { type: "number", description: "Custo do terreno (R$)" },
              taxa_desconto_mensal: { type: "number", description: "Taxa de desconto mensal (ex: 0.01 = 1%)" },
              prazo_vendas_meses: { type: "number", description: "Prazo de vendas em meses" },
              prazo_obras_meses: { type: "number", description: "Prazo de obras em meses" },
              scenario_name: { type: "string", description: "Nome do cenário" },
            },
          },
        },
        required: ["scenario_id", "updates"],
      },
    },
  },
  // ─── US-106: Análise Preditiva ───
  {
    type: "function",
    function: {
      name: "predict_viability",
      description: `Análise preditiva rápida: dado apenas localização e parâmetros básicos de um terreno, estima VPL, TIR e performance score com banda de confiança (otimista/realista/pessimista). Usa benchmarks regionais e heurísticas para gerar uma estimativa em segundos, SEM precisar de cenário salvo. Ideal para avaliação rápida de terrenos em prospecção.`,
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "Cidade do terreno" },
          state: { type: "string", description: "UF (ex: SP, MG, GO)" },
          area_total_m2: { type: "number", description: "Área total do terreno em m²" },
          qtd_lotes_estimada: { type: "number", description: "Número estimado de lotes (se não informado, estima automaticamente)" },
          preco_m2_estimado: { type: "number", description: "Preço estimado do m² na região (R$). Se não informado, usa benchmark regional." },
          tipo_empreendimento: { type: "string", enum: ["aberto", "fechado"], description: "Tipo de loteamento (default: aberto)" },
        },
        required: ["city", "state", "area_total_m2"],
      },
    },
  },
  // ─── US-108: Comparador de Cenários ───
  {
    type: "function",
    function: {
      name: "compare_parcelamento_scenarios",
      description: `Compara 2 ou mais cenários financeiros de um projeto de parcelamento lado a lado. Mostra delta (diferença) entre KPIs: VPL, TIR, payback, margem, score, VGV, custo total. Identifica qual cenário é melhor em cada métrica e recomenda o mais equilibrado.`,
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto de parcelamento" },
          scenario_ids: {
            type: "array",
            items: { type: "string" },
            description: "Lista de UUIDs dos cenários a comparar (2 a 5). Se vazio, compara todos os cenários do projeto.",
          },
        },
        required: ["project_id"],
      },
    },
  },
  // ─── US-109: Detector de Red Flags ───
  {
    type: "function",
    function: {
      name: "detect_red_flags",
      description: `Analisa um projeto de parcelamento em profundidade e detecta riscos não-óbvios usando IA generativa. Examina: indicadores financeiros, premissas, conformidade legal, localização e condições de mercado. Retorna lista priorizada de red flags com severidade (crítico/alto/médio/baixo), explicação e ação recomendada.`,
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto de parcelamento" },
        },
        required: ["project_id"],
      },
    },
  },
  // ─── Bloco H: Regulações Brasil (Sessão 141) ───
  {
    type: "function",
    function: {
      name: "calc_itbi",
      description: `Calcula o ITBI (Imposto de Transmissão de Bens Imóveis) estimado para um empreendimento. Considera alíquota municipal (1-3%), VGV, valor do terreno e número de lotes. Retorna ITBI sobre aquisição do terreno, ITBI sobre vendas (por lote e total), % do VGV e dicas de imunidade (integralização em SPE). Art. 156 II CF/88.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto. Puxa VGV, cidade, UF e premissas automaticamente." },
          aliquota_override_pct: { type: "number", description: "Alíquota manual (opcional). Se não informado, usa tabela municipal." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_outorga",
      description: `Calcula a Outorga Onerosa do Direito de Construir (OODC) conforme Estatuto da Cidade Art. 28-31. Para loteamentos abertos, muitos municípios ISENTAM. Calcula com base no CA básico vs utilizado × fator de planejamento × valor do m². Retorna valor estimado, isenção e parâmetros urbanísticos.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
          area_construida_m2: { type: "number", description: "Área construída em m² (se aplicável)." },
          valor_m2_terreno: { type: "number", description: "Valor do m² do terreno (R$)." },
          coeficiente_utilizado: { type: "number", description: "CA pretendido (se não informado, calcula de área construída/terreno)." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_lei_verde",
      description: `Verifica exigências da "Lei do Verde" / legislação ambiental municipal para o empreendimento. Checklist: área verde mínima, taxa de permeabilidade, reserva legal (por bioma), arborização viária e compensação ambiental (mudas). Retorna status (pass/warn/fail/pending) por item com recomendações.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
          bioma: { type: "string", enum: ["cerrado", "mata_atlantica", "amazonia", "caatinga", "pampa", "pantanal"], description: "Bioma da região (default: cerrado)." },
          area_verde_m2: { type: "number", description: "Área verde projetada em m² (opcional)." },
          area_permeavel_m2: { type: "number", description: "Área permeável projetada em m² (opcional)." },
          extensao_vias_m: { type: "number", description: "Extensão total de vias em metros (opcional)." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_cnpj_spe",
      description: `Valida um CNPJ de incorporador ou SPE (Sociedade de Propósito Específico). Consulta a Receita Federal e verifica: dígitos, situação cadastral, CNAE compatível com atividade imobiliária, natureza jurídica, capital social e tempo de atividade. Identifica se é SPE e retorna alertas.`,
      parameters: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ a validar (com ou sem máscara)." },
        },
        required: ["cnpj"],
      },
    },
  },
  // ─── Module 8: Benchmarks de Mercado (Bloco H Sprint 2 — Sessão 142) ───
  {
    type: "function",
    function: {
      name: "fetch_sinapi",
      description: `Consulta o catálogo SINAPI (Sistema Nacional de Pesquisa de Custos da Construção Civil) da Caixa Econômica Federal. Retorna custos unitários (material + mão de obra) por UF para composições de infraestrutura: terraplanagem, pavimentação, drenagem, rede de água/esgoto, rede elétrica, guias/sarjetas, calçadas, paisagismo e contenções. Útil para validar premissas de custo de obra.`,
      parameters: {
        type: "object",
        properties: {
          uf: { type: "string", description: "Sigla da UF (ex: SP, RJ, MG). Default: SP." },
          codigo: { type: "string", description: "Código SINAPI exato (ex: '73964')." },
          busca: { type: "string", description: "Busca textual na descrição (ex: 'terraplanagem', 'asfalto')." },
          grupo: { type: "string", description: "Filtrar por grupo: Terraplanagem, Pavimentação, Drenagem, Rede de Água, Rede de Esgoto, Rede Elétrica, Guias e Sarjetas, Calçadas e Passeios, Paisagismo, Contenções." },
          limit: { type: "number", description: "Limite de resultados (default: 20, max: 50)." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_secovi",
      description: `Consulta benchmarks SECOVI (Sindicato da Habitação): preço médio por m², faixa de preço, variação 12 meses, IVV (Índice de Velocidade de Vendas), meses de estoque e absorção líquida por cidade e tipo de imóvel (lote, casa, apartamento). Cobre 20+ cidades do Brasil. Útil para validar premissas comerciais e posicionamento de preço.`,
      parameters: {
        type: "object",
        properties: {
          cidade: { type: "string", description: "Nome da cidade (ex: 'Piracicaba', 'São Paulo')." },
          uf: { type: "string", description: "Sigla da UF para filtrar." },
          tipo_imovel: { type: "string", enum: ["lote", "casa", "apartamento", "comercial"], description: "Tipo de imóvel." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_abrainc",
      description: `Consulta indicadores ABRAINC-FIPE (Associação Brasileira de Incorporadoras Imobiliárias): lançamentos e vendas por região, VGV, VSO (Vendas sobre Oferta), taxa de distrato, margem bruta média e prazo de obra por segmento (MCMV, Médio/Alto Padrão, Loteamento). Cobre as 5 regiões do Brasil. Útil para benchmarking estratégico do empreendimento.`,
      parameters: {
        type: "object",
        properties: {
          regiao: { type: "string", description: "Região: Sudeste, Sul, Nordeste, Centro-Oeste, Norte." },
          uf: { type: "string", description: "UF principal (ex: SP, PR, BA, GO, PA)." },
          segmento: { type: "string", enum: ["MCMV", "MAP", "loteamento"], description: "Segmento do mercado." },
        },
        required: [],
      },
    },
  },
  // ─── Module 9: Censo IBGE (Bloco H Sprint 3 — Sessão 143) ───
  {
    type: "function",
    function: {
      name: "fetch_census_income",
      description: `Consulta renda por setor censitário do IBGE Censo 2022. Retorna renda domiciliar média, renda per capita, percentual acima de 5 SM e abaixo de 1 SM, classe predominante (A/B/C/D/E). Útil para qualificar demanda e ajustar pricing de lotes.`,
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do município (ex: 'Piracicaba', 'São Paulo')." },
          uf: { type: "string", description: "Sigla da UF." },
          classe: { type: "string", description: "Filtrar por classe: A, B, C, D, E." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_census_demographics",
      description: `Consulta dados demográficos do IBGE Censo 2022 por município: população, densidade, crescimento anual, urbanização, idade média, índice de envelhecimento. Útil para análise de demanda imobiliária.`,
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do município." },
          uf: { type: "string", description: "Sigla da UF." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_census_housing",
      description: `Consulta dados de domicílios do IBGE Censo 2022: total de domicílios, posse (próprio/alugado/cedido), infraestrutura (esgoto/água/lixo), média de moradores, déficit habitacional estimado. Útil para dimensionar demanda de lotes.`,
      parameters: {
        type: "object",
        properties: {
          municipio: { type: "string", description: "Nome do município." },
          uf: { type: "string", description: "Sigla da UF." },
        },
        required: [],
      },
    },
  },
  // ─── Module 10: Embargos Ambientais (Bloco H Sprint 3 — Sessão 143) ───
  {
    type: "function",
    function: {
      name: "check_ibama_embargoes",
      description: `Verifica áreas embargadas pelo IBAMA na região do terreno. Busca por coordenadas (lat/lng + raio) ou município/UF. Retorna lista de embargos vigentes com nível de risco (baixo/moderado/alto/crítico), tipo de infração, bioma e autuado. CRÍTICO para due diligence ambiental antes de aquisição.`,
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude do terreno." },
          lng: { type: "number", description: "Longitude do terreno." },
          municipio: { type: "string", description: "Nome do município." },
          uf: { type: "string", description: "Sigla da UF." },
          raio_busca_km: { type: "number", description: "Raio de busca em km (default: 10)." },
          incluir_inativos: { type: "boolean", description: "Incluir embargos suspensos/anulados (default: false)." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_icmbio_ucs",
      description: `Verifica sobreposição do terreno com Unidades de Conservação do ICMBio (CNUC). Detecta se o terreno está dentro de UC de Proteção Integral (bloqueante), Uso Sustentável (restritivo), ou em zona de amortecimento. Retorna restrições, ato legal e impacto no empreendimento.`,
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude do terreno." },
          lng: { type: "number", description: "Longitude do terreno." },
          municipio: { type: "string", description: "Nome do município." },
          uf: { type: "string", description: "Sigla da UF." },
          raio_busca_km: { type: "number", description: "Raio de busca em km (default: 15)." },
        },
        required: [],
      },
    },
  },
  // ─── Module 11: Exportação DXF (Bloco H Sprint 3 — Sessão 143) ───
  {
    type: "function",
    function: {
      name: "generate_dxf_project",
      description: `Gera pré-projeto urbanístico em formato DXF (AutoCAD R12) para submissão à prefeitura. Inclui layers: perímetro, lotes por quadra, vias com eixos, APPs, áreas verdes, áreas institucionais, textos e carimbo. Opcionalmente converte para DWG via ConvertAPI. Retorna base64 do arquivo para download.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto de parcelamento." },
          convert_to_dwg: { type: "boolean", description: "Converter para DWG também (requer ConvertAPI). Default: false." },
        },
        required: ["development_id"],
      },
    },
  },
  // ─── Module 12: MapBiomas — Uso e Cobertura do Solo (Bloco H Sprint 4 — Sessão 144) ───
  {
    type: "function",
    function: {
      name: "fetch_mapbiomas_land_use",
      description: `Consulta a classificação de uso e cobertura do solo do MapBiomas (Collection 8) via Google Earth Engine para um ano específico. Retorna histograma de classes (floresta, pastagem, agricultura, área urbana, água, etc.) com percentuais e área em hectares. Resolução 30m Landsat. Cache 90 dias.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto de parcelamento." },
          year: { type: "number", description: "Ano de referência (2000-2025). Default: ano anterior." },
          buffer_radius_m: { type: "number", description: "Raio do buffer em metros ao redor do centroid. Default: 1000." },
        },
        required: ["development_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_mapbiomas_time_series",
      description: `Consulta série temporal MapBiomas (últimos N anos) com análise de tendência de desmatamento e urbanização. Retorna histograma por ano + trend (increasing/stable/decreasing) + change summary por categoria. Ideal para análise histórica de uso do solo.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto de parcelamento." },
          start_year: { type: "number", description: "Ano inicial da série. Default: 10 anos atrás." },
          end_year: { type: "number", description: "Ano final da série. Default: ano anterior." },
          buffer_radius_m: { type: "number", description: "Raio do buffer em metros. Default: 1000." },
        },
        required: ["development_id"],
      },
    },
  },
  // ─── Module 13: Memorial Descritivo (Bloco H Sprint 5 — Sessão 145) ───
  {
    type: "function",
    function: {
      name: "generate_memorial_descritivo",
      description: `Gera Memorial Descritivo automático no formato aceito por Cartórios de Registro de Imóveis (Lei 6.015/73). Recebe vértices e dados do imóvel, calcula azimutes e distâncias, formata com IA (Gemini) e salva no banco. Retorna texto e HTML do memorial.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto de parcelamento." },
          property_name: { type: "string", description: "Nome/denominação do imóvel." },
          municipality: { type: "string", description: "Município." },
          state: { type: "string", description: "UF (2 letras)." },
          comarca: { type: "string", description: "Comarca de registro." },
          owner_name: { type: "string", description: "Nome do proprietário." },
          owner_cpf_cnpj: { type: "string", description: "CPF ou CNPJ do proprietário." },
        },
        required: ["development_id", "property_name", "municipality", "state", "comarca", "owner_name", "owner_cpf_cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_memorial_descritivos",
      description: `Lista memoriais descritivos gerados para um projeto de parcelamento.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
        },
        required: ["development_id"],
      },
    },
  },
  // ─── Module 14: Zoneamento Municipal (Bloco H Sprint 5 — Sessão 145) ───
  {
    type: "function",
    function: {
      name: "analyze_zoneamento_pdf",
      description: `Analisa PDF de Plano Diretor municipal usando OCR + LLM (Gemini) para extrair parâmetros de zoneamento: Coeficiente de Aproveitamento (CA), Taxa de Ocupação, Gabarito, Recuos, Zona de uso, Permeabilidade, Usos permitidos/proibidos. Retorna dados estruturados com score de confiança.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
          pdf_base64: { type: "string", description: "PDF em base64 do Plano Diretor." },
          pdf_url: { type: "string", description: "URL do PDF (alternativa ao base64)." },
          municipality: { type: "string", description: "Município." },
          state: { type: "string", description: "UF." },
        },
        required: ["development_id", "municipality", "state"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_zoneamento",
      description: `Retorna dados de zoneamento já extraídos para um projeto.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
        },
        required: ["development_id"],
      },
    },
  },
  // ─── Module 15: CRI Matrícula (Bloco H Sprint 5 — Sessão 145) ───
  {
    type: "function",
    function: {
      name: "register_cri_matricula",
      description: `Registra manualmente dados de matrícula de imóvel do Cartório de Registro de Imóveis (CRI). Inclui número da matrícula, cartório, comarca, proprietário, área, averbações e ônus.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
          numero_matricula: { type: "string", description: "Número da matrícula (5-6 dígitos)." },
          cartorio_nome: { type: "string", description: "Nome do cartório." },
          comarca: { type: "string", description: "Comarca." },
          uf: { type: "string", description: "UF do cartório." },
          proprietario_nome: { type: "string", description: "Nome do proprietário na matrícula." },
          area_terreno_m2: { type: "number", description: "Área total em m²." },
        },
        required: ["development_id", "numero_matricula", "cartorio_nome", "comarca", "uf", "proprietario_nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_cri_matriculas",
      description: `Lista matrículas registradas para um projeto de parcelamento.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
        },
        required: ["development_id"],
      },
    },
  },
  // ─── Module 16: FII/CRA Simulador (Bloco H Sprint 5 — Sessão 145) ───
  {
    type: "function",
    function: {
      name: "simulate_fii",
      description: `Simula constituição de FII (Fundo de Investimento Imobiliário) com o empreendimento como ativo. Calcula valor da cota, distribuição mensal, dividend yield, TIR projetada e projeções de 10 anos.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
          vgv_total: { type: "number", description: "Valor Geral de Vendas total (R$)." },
          monthly_revenue: { type: "number", description: "Receita mensal esperada (R$)." },
          vacancy_rate: { type: "number", description: "Taxa de vacância (%). Default: 5." },
          num_quotas: { type: "number", description: "Número de cotas do FII. Default: 50000." },
        },
        required: ["development_id", "vgv_total", "monthly_revenue"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_cri_cra",
      description: `Simula securitização de recebíveis via CRI/CRA. Calcula tranches (sênior/subordinada), WAL, taxa efetiva, custo total de juros e fluxo de caixa mensal.`,
      parameters: {
        type: "object",
        properties: {
          development_id: { type: "string", description: "UUID do projeto." },
          total_receivables: { type: "number", description: "Total de recebíveis (R$)." },
          duration_months: { type: "number", description: "Prazo em meses. Default: 120." },
          spread_over_cdi: { type: "number", description: "Spread sobre CDI (%). Default: 2.5." },
          subordination_pct: { type: "number", description: "Subordinação (%). Default: 20." },
        },
        required: ["development_id", "total_receivables"],
      },
    },
  },
];

// ============================================================
// Tool Execution Handlers
// ============================================================

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  tenantId: string;
  userName: string;
}

async function executeSearchContracts(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  let query = ctx.supabase
    .from("contracts")
    .select("id, contract_type, status, start_date, end_date, monthly_value, property_id, properties(name, address)")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(args.limit) || 10, 20));

  if (args.status) query = query.eq("status", args.status);
  if (args.contract_type) query = query.eq("contract_type", args.contract_type);
  if (args.expiring_within_days) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + Number(args.expiring_within_days));
    query = query
      .gte("end_date", new Date().toISOString().split("T")[0])
      .lte("end_date", futureDate.toISOString().split("T")[0]);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar contratos: ${error.message}`);

  return {
    total: data?.length ?? 0,
    contracts: (data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      type: c.contract_type,
      status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      monthly_value: c.monthly_value,
      property: (c as Record<string, unknown>).properties,
    })),
  };
}

async function executeGetContractDetails(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const { data: contract, error } = await ctx.supabase
    .from("contracts")
    .select("*, properties(name, address, city, state, area_total, area_built)")
    .eq("id", args.contract_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar contrato: ${error.message}`);
  if (!contract) return { error: "Contrato não encontrado" };

  // Fetch parties
  const { data: parties } = await ctx.supabase
    .from("contract_parties")
    .select("role, people(name, cpf_cnpj, email, phone)")
    .eq("contract_id", args.contract_id);

  // Fetch overdue installments
  const { data: overdueInstallments } = await ctx.supabase
    .from("contract_installments")
    .select("id, amount, due_date, status")
    .eq("contract_id", args.contract_id)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "atrasado")
    .limit(5);

  // Fetch active obligations
  const { data: obligations } = await ctx.supabase
    .from("contract_obligations")
    .select("id, title, obligation_type, due_date, status")
    .eq("contract_id", args.contract_id)
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["pendente", "em_andamento"])
    .order("due_date")
    .limit(10);

  return {
    contract: {
      id: contract.id,
      type: contract.contract_type,
      status: contract.status,
      start_date: contract.start_date,
      end_date: contract.end_date,
      monthly_value: contract.monthly_value,
      adjustment_index: contract.adjustment_index,
      property: contract.properties,
    },
    parties: (parties ?? []).map((p: Record<string, unknown>) => ({
      role: p.role,
      person: p.people,
    })),
    overdue_installments: overdueInstallments ?? [],
    active_obligations: obligations ?? [],
  };
}

async function executeTransitionContractStatus(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const contractId = String(args.contract_id);
  const toStatus = String(args.to_status);

  // Get current contract status
  const { data: contract } = await ctx.supabase
    .from("contracts")
    .select("id, status, contract_type")
    .eq("id", contractId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!contract) return { error: "Contrato não encontrado" };

  const fromStatus = contract.status;

  // Check if transition is allowed via allowed_transitions table
  const { data: allowed } = await ctx.supabase
    .from("allowed_transitions")
    .select("id")
    .eq("from_status", fromStatus)
    .eq("to_status", toStatus)
    .eq("is_active", true)
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`)
    .limit(1);

  if (!allowed || allowed.length === 0) {
    return { error: `Transição não permitida: ${fromStatus} → ${toStatus}` };
  }

  // Execute transition with optimistic locking
  const { data: updated, error: updateError } = await ctx.supabase
    .from("contracts")
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq("id", contractId)
    .eq("status", fromStatus)
    .select("id");

  if (updateError) throw new Error(`Erro ao atualizar status: ${updateError.message}`);
  if (!updated || updated.length === 0) {
    return { error: "Contrato foi modificado por outro usuário. Tente novamente." };
  }

  // Log lifecycle event
  await ctx.supabase.from("contract_lifecycle_events").insert({
    contract_id: contractId,
    tenant_id: ctx.tenantId,
    event_type: "status_change",
    from_status: fromStatus,
    to_status: toStatus,
    performed_by: ctx.userId,
    notes: `Transição via Copilot IA por ${ctx.userName}`,
  });

  return {
    success: true,
    message: `Contrato atualizado: ${fromStatus} → ${toStatus}`,
    contract_id: contractId,
  };
}

async function executeGetContractSummary(ctx: ToolContext): Promise<unknown> {
  // Contracts by status
  const { data: contracts } = await ctx.supabase
    .from("contracts")
    .select("id, status, monthly_value, end_date")
    .eq("tenant_id", ctx.tenantId);

  if (!contracts) return { total: 0, by_status: {}, total_monthly_value: 0 };

  const byStatus: Record<string, number> = {};
  let totalMonthly = 0;
  let expiringCount = 0;
  const now = Date.now();
  const thirtyDays = 30 * 86400000;

  for (const c of contracts) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (c.status === "ativo" && c.monthly_value) totalMonthly += Number(c.monthly_value);
    if (c.end_date) {
      const daysLeft = new Date(c.end_date).getTime() - now;
      if (daysLeft > 0 && daysLeft <= thirtyDays) expiringCount++;
    }
  }

  return {
    total: contracts.length,
    by_status: byStatus,
    total_active_monthly_value: totalMonthly,
    expiring_within_30_days: expiringCount,
  };
}

async function executeListOverdueObligations(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Number(args.limit) || 10, 20);
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await ctx.supabase
    .from("contract_obligations")
    .select("id, title, obligation_type, due_date, status, contract_id, contracts(contract_type, properties(name))")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["pendente", "em_andamento"])
    .lt("due_date", today)
    .order("due_date")
    .limit(limit);

  if (error) throw new Error(`Erro ao buscar obrigações: ${error.message}`);

  return {
    total: data?.length ?? 0,
    obligations: (data ?? []).map((o: Record<string, unknown>) => ({
      id: o.id,
      title: o.title,
      type: o.obligation_type,
      due_date: o.due_date,
      contract_id: o.contract_id,
      contract: o.contracts,
    })),
  };
}

async function executeListUpcomingObligations(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const days = Number(args.days) || 30;
  const limit = Math.min(Number(args.limit) || 10, 20);
  const today = new Date().toISOString().split("T")[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureDateStr = futureDate.toISOString().split("T")[0];

  const { data, error } = await ctx.supabase
    .from("contract_obligations")
    .select("id, title, obligation_type, due_date, status, contract_id, contracts(contract_type, properties(name))")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["pendente", "em_andamento"])
    .gte("due_date", today)
    .lte("due_date", futureDateStr)
    .order("due_date")
    .limit(limit);

  if (error) throw new Error(`Erro ao buscar obrigações: ${error.message}`);

  return {
    total: data?.length ?? 0,
    days_ahead: days,
    obligations: (data ?? []).map((o: Record<string, unknown>) => ({
      id: o.id,
      title: o.title,
      type: o.obligation_type,
      due_date: o.due_date,
      contract_id: o.contract_id,
      contract: o.contracts,
    })),
  };
}

async function executeListUnreadNotifications(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Number(args.limit) || 10, 20);

  let query = ctx.supabase
    .from("notifications")
    .select("id, title, message, category, priority, created_at, reference_type, reference_id")
    .eq("user_id", ctx.userId)
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.category) query = query.eq("category", args.category);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar notificações: ${error.message}`);

  return {
    total: data?.length ?? 0,
    notifications: data ?? [],
  };
}

async function executeCreateNotification(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const { error } = await ctx.supabase.from("notifications").insert({
    user_id: ctx.userId,
    tenant_id: ctx.tenantId,
    title: String(args.title),
    message: String(args.message),
    category: String(args.category || "ia"),
    priority: String(args.priority || "medium"),
    read: false,
  });

  if (error) throw new Error(`Erro ao criar notificação: ${error.message}`);

  return { success: true, message: `Notificação "${args.title}" criada com sucesso.` };
}

// ─── Criação Conversacional ───

async function resolvePropertyBySearch(ctx: ToolContext, search: string): Promise<string | null> {
  const normalized = search.toLowerCase().trim();
  const { data } = await ctx.supabase
    .from("properties")
    .select("id, title, address, city, neighborhood")
    .eq("tenant_id", ctx.tenantId)
    .limit(20);

  if (!data || data.length === 0) return null;

  // Try exact match first, then fuzzy
  for (const p of data) {
    const haystack = [p.title, p.address, p.city, p.neighborhood]
      .filter(Boolean).join(" ").toLowerCase();
    if (haystack.includes(normalized)) return p.id;
  }
  return null;
}

async function resolvePersonBySearch(ctx: ToolContext, search: string): Promise<string | null> {
  const normalized = search.toLowerCase().trim();
  const { data } = await ctx.supabase
    .from("people")
    .select("id, name, cpf_cnpj, email")
    .eq("tenant_id", ctx.tenantId)
    .limit(30);

  if (!data || data.length === 0) return null;

  for (const p of data) {
    const haystack = [p.name, p.cpf_cnpj, p.email]
      .filter(Boolean).join(" ").toLowerCase();
    if (haystack.includes(normalized)) return p.id;
  }
  return null;
}

async function executeCreateContract(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const contractType = String(args.contract_type || "locacao");
  const status = String(args.status || "rascunho");
  const startDate = args.start_date ? String(args.start_date) : null;
  const endDate = args.end_date ? String(args.end_date) : null;

  if (!startDate || !endDate) {
    return { error: "Datas de início e término são obrigatórias. Pergunte ao usuário." };
  }

  // Validate dates
  if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
    return { error: "Formato de data inválido. Use YYYY-MM-DD." };
  }

  // Resolve property
  let propertyId = args.property_id ? String(args.property_id) : null;
  if (!propertyId && args.property_search) {
    propertyId = await resolvePropertyBySearch(ctx, String(args.property_search));
    if (!propertyId) {
      return { error: `Imóvel "${args.property_search}" não encontrado. Peça ao usuário para verificar o nome ou informar o ID.` };
    }
  }

  // Build contract insert
  const contractData: Record<string, unknown> = {
    contract_type: contractType,
    status,
    start_date: startDate,
    end_date: endDate,
    tenant_id: ctx.tenantId,
    created_by: ctx.userId,
  };

  if (propertyId) contractData.property_id = propertyId;
  if (args.monthly_value) contractData.monthly_value = Number(args.monthly_value);
  if (args.total_value) contractData.total_value = Number(args.total_value);
  if (args.adjustment_index) contractData.adjustment_index = String(args.adjustment_index);
  if (args.guarantee_type) contractData.guarantee_type = String(args.guarantee_type);
  if (args.guarantee_value) contractData.guarantee_value = Number(args.guarantee_value);
  if (args.payment_due_day) contractData.payment_due_day = Number(args.payment_due_day);
  if (args.notes) contractData.notes = String(args.notes);

  // Insert contract
  const { data: newContract, error: insertError } = await ctx.supabase
    .from("contracts")
    .insert(contractData)
    .select("id, contract_type, status, start_date, end_date, monthly_value, total_value")
    .single();

  if (insertError) throw new Error(`Erro ao criar contrato: ${insertError.message}`);

  // Resolve and insert parties
  const parties = Array.isArray(args.parties) ? args.parties : [];
  const resolvedParties: { person_id: string; role: string }[] = [];
  const unresolvedParties: string[] = [];

  for (const party of parties) {
    const p = party as Record<string, unknown>;
    const role = String(p.role || "locatario");
    let personId = p.person_id ? String(p.person_id) : null;

    if (!personId && p.person_search) {
      personId = await resolvePersonBySearch(ctx, String(p.person_search));
    }

    if (personId) {
      resolvedParties.push({ person_id: personId, role });
    } else {
      unresolvedParties.push(`${p.person_search || "desconhecido"} (${role})`);
    }
  }

  if (resolvedParties.length > 0) {
    const { error: pErr } = await ctx.supabase
      .from("contract_parties")
      .insert(resolvedParties.map(p => ({
        ...p,
        contract_id: newContract.id,
        tenant_id: ctx.tenantId,
      })));
    if (pErr) console.error("Erro ao vincular partes:", pErr.message);
  }

  // Log lifecycle event
  await ctx.supabase.from("contract_lifecycle_events").insert({
    contract_id: newContract.id,
    tenant_id: ctx.tenantId,
    event_type: "status_change",
    from_status: null,
    to_status: status,
    performed_by: ctx.userId,
    notes: `Contrato criado via Copilot IA (conversa) por ${ctx.userName}`,
  });

  return {
    success: true,
    contract_id: newContract.id,
    contract: newContract,
    parties_linked: resolvedParties.length,
    parties_not_found: unresolvedParties,
    message: unresolvedParties.length > 0
      ? `Contrato criado com sucesso! ${unresolvedParties.length} parte(s) não encontrada(s): ${unresolvedParties.join(", ")}. Vincule manualmente no formulário.`
      : `Contrato criado com sucesso! ${resolvedParties.length} parte(s) vinculada(s).`,
  };
}

async function executePrefillContractForm(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  // Resolve property if search term provided
  let propertyId = args.property_id ? String(args.property_id) : "";
  if (!propertyId && args.property_search) {
    const found = await resolvePropertyBySearch(ctx, String(args.property_search));
    if (found) propertyId = found;
  }

  // Resolve parties
  const parties = Array.isArray(args.parties) ? args.parties : [];
  const resolvedParties: { person_id: string; role: string }[] = [];
  const unresolvedParties: string[] = [];

  for (const party of parties) {
    const p = party as Record<string, unknown>;
    const role = String(p.role || "locatario");
    let personId = p.person_id ? String(p.person_id) : "";

    if (!personId && p.person_search) {
      const found = await resolvePersonBySearch(ctx, String(p.person_search));
      if (found) personId = found;
      else unresolvedParties.push(String(p.person_search));
    }

    if (personId) {
      resolvedParties.push({ person_id: personId, role });
    }
  }

  // Build prefill data matching ContractFormValues shape
  const prefillData: Record<string, unknown> = {
    contract_type: args.contract_type || "locacao",
    status: "rascunho",
    property_id: propertyId,
  };

  if (args.start_date) prefillData.start_date = String(args.start_date);
  if (args.end_date) prefillData.end_date = String(args.end_date);
  if (args.monthly_value) prefillData.monthly_value = Number(args.monthly_value);
  if (args.total_value) prefillData.total_value = Number(args.total_value);
  if (args.adjustment_index) prefillData.adjustment_index = String(args.adjustment_index);
  if (args.guarantee_type) prefillData.guarantee_type = String(args.guarantee_type);
  if (args.guarantee_value) prefillData.guarantee_value = Number(args.guarantee_value);
  if (args.payment_due_day) prefillData.payment_due_day = Number(args.payment_due_day);
  if (args.notes) prefillData.notes = String(args.notes);

  return {
    action: "PREFILL_CONTRACT",
    prefill: prefillData,
    parties: resolvedParties,
    unresolved_parties: unresolvedParties,
    message: `Dados preparados para o formulário! ${unresolvedParties.length > 0 ? `Não encontrei: ${unresolvedParties.join(", ")}. Você pode vinculá-los manualmente.` : "Todas as partes foram encontradas."}`,
  };
}

async function executeSearchProperties(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const search = String(args.search || "").toLowerCase().trim();
  const limit = Math.min(Number(args.limit) || 5, 10);

  const { data, error } = await ctx.supabase
    .from("properties")
    .select("id, title, address, neighborhood, city, state, property_type, status, area_total")
    .eq("tenant_id", ctx.tenantId)
    .limit(50);

  if (error) throw new Error(`Erro ao buscar imóveis: ${error.message}`);

  // Client-side fuzzy search (Supabase doesn't have good fuzzy search)
  const results = (data ?? [])
    .filter((p: Record<string, unknown>) => {
      const haystack = [p.title, p.address, p.neighborhood, p.city, p.state]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .slice(0, limit)
    .map((p: Record<string, unknown>) => ({
      id: p.id,
      title: p.title,
      address: p.address,
      neighborhood: p.neighborhood,
      city: p.city,
      state: p.state,
      type: p.property_type,
      status: p.status,
      area: p.area_total,
    }));

  return { total: results.length, properties: results };
}

async function executeSearchPeople(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const search = String(args.search || "").toLowerCase().trim();
  const limit = Math.min(Number(args.limit) || 5, 10);

  const { data, error } = await ctx.supabase
    .from("people")
    .select("id, name, cpf_cnpj, email, phone, person_type, entity_type")
    .eq("tenant_id", ctx.tenantId)
    .limit(50);

  if (error) throw new Error(`Erro ao buscar pessoas: ${error.message}`);

  const results = (data ?? [])
    .filter((p: Record<string, unknown>) => {
      const haystack = [p.name, p.cpf_cnpj, p.email]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .slice(0, limit)
    .map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      cpf_cnpj: p.cpf_cnpj,
      email: p.email,
      phone: p.phone,
      type: p.person_type,
      entity: p.entity_type,
    }));

  return { total: results.length, people: results };
}

// ─── Parcelamento de Solo ───

async function executeListParcelamentoProjects(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Number(args.limit) || 10, 20);

  let query = ctx.supabase
    .from("development_parcelamento")
    .select("id, name, status, total_units, vgv_estimado, area_total_m2, city, state, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.status) query = query.eq("status", args.status);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar projetos de parcelamento: ${error.message}`);

  return {
    total: data?.length ?? 0,
    projects: (data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      total_units: p.total_units,
      vgv_estimado: p.vgv_estimado,
      area_total_m2: p.area_total_m2,
      city: p.city,
      state: p.state,
    })),
  };
}

async function executeGetParcelamentoFinancial(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.project_id);

  // Get active scenario
  const { data: scenario, error } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("*")
    .eq("development_id", projectId)
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar dados financeiros: ${error.message}`);
  if (!scenario) return { error: "Nenhuma simulação financeira encontrada para este projeto. O usuário precisa rodar uma simulação primeiro." };

  const s = scenario as Record<string, unknown>;
  return {
    scenario_id: s.id,
    scenario_name: s.scenario_name,
    is_calculated: s.is_calculated,
    // KPIs
    vgv_total: s.vgv_total,
    custo_total: s.custo_total,
    lucro_liquido: s.lucro_liquido,
    margem_liquida: s.margem_liquida,
    vpl: s.vpl,
    tir_mensal: s.tir_mensal,
    tir_anual: s.tir_anual,
    payback_meses: s.payback_meses,
    performance_score: s.performance_score,
    // Break-even
    break_even_units: s.break_even_units,
    break_even_pct: s.break_even_pct,
    // Premissas de entrada
    qtd_lotes: s.qtd_lotes,
    preco_medio_lote: s.preco_medio_lote,
    custo_infra_por_lote: s.custo_infra_por_lote,
    custo_terreno: s.custo_terreno,
    taxa_desconto_mensal: s.taxa_desconto_mensal,
    prazo_vendas_meses: s.prazo_vendas_meses,
    prazo_obras_meses: s.prazo_obras_meses,
  };
}

async function executeGetParcelamentoScenarios(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.project_id);
  const limit = Math.min(Number(args.limit) || 5, 10);

  const { data, error } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("id, scenario_name, is_active, is_calculated, vpl, tir_anual, payback_meses, performance_score, vgv_total, custo_total, lucro_liquido, margem_liquida, qtd_lotes, preco_medio_lote, created_at")
    .eq("development_id", projectId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao buscar cenários: ${error.message}`);

  return {
    total: data?.length ?? 0,
    scenarios: (data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.scenario_name,
      is_active: s.is_active,
      is_calculated: s.is_calculated,
      vpl: s.vpl,
      tir_anual: s.tir_anual,
      payback_meses: s.payback_meses,
      performance_score: s.performance_score,
      vgv_total: s.vgv_total,
      custo_total: s.custo_total,
      lucro_liquido: s.lucro_liquido,
      margem_liquida: s.margem_liquida,
      qtd_lotes: s.qtd_lotes,
      preco_medio_lote: s.preco_medio_lote,
    })),
  };
}

async function executeGetDeepPremises(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const scenarioId = String(args.scenario_id);

  const { data, error } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("id, scenario_name, deep_premises, tenant_id")
    .eq("id", scenarioId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar premissas: ${error.message}`);
  if (!data) return { error: "Cenário não encontrado." };
  if ((data as Record<string, unknown>).tenant_id !== ctx.tenantId) return { error: "Acesso negado." };

  const dp = (data as Record<string, unknown>).deep_premises;
  if (!dp) return { scenario_id: scenarioId, scenario_name: (data as Record<string, unknown>).scenario_name, deep_premises: null, message: "Premissas profundas ainda não foram configuradas para este cenário." };

  return {
    scenario_id: scenarioId,
    scenario_name: (data as Record<string, unknown>).scenario_name,
    deep_premises: dp,
  };
}

async function executeGetParcelamentoCompliance(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.project_id);

  const { data, error } = await ctx.supabase
    .from("parcelamento_legal_analyses")
    .select("id, compliance_score, checklist_6766, checklist_4591, parecer, missing_info, created_at")
    .eq("development_id", projectId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar conformidade: ${error.message}`);
  if (!data) return { error: "Nenhuma análise de conformidade encontrada. O usuário precisa rodar a análise legal primeiro na aba Conformidade." };

  const d = data as Record<string, unknown>;
  const checklist6766 = d.checklist_6766 as Record<string, unknown>[] | null;
  const checklist4591 = d.checklist_4591 as Record<string, unknown>[] | null;

  const pending6766 = checklist6766?.filter((i) => i.status !== "conforme" && i.status !== "nao_aplicavel") ?? [];
  const pending4591 = checklist4591?.filter((i) => i.status !== "conforme" && i.status !== "nao_aplicavel") ?? [];

  return {
    compliance_score: d.compliance_score,
    total_items_6766: checklist6766?.length ?? 0,
    pending_items_6766: pending6766.length,
    pending_details_6766: pending6766.slice(0, 5).map((i) => ({ item: i.item || i.descricao, status: i.status })),
    total_items_4591: checklist4591?.length ?? 0,
    pending_items_4591: pending4591.length,
    pending_details_4591: pending4591.slice(0, 5).map((i) => ({ item: i.item || i.descricao, status: i.status })),
    parecer_resumo: typeof d.parecer === "string" ? (d.parecer as string).slice(0, 500) : null,
    missing_info: d.missing_info,
    analysis_date: d.created_at,
  };
}

async function executeSuggestScoreImprovements(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.project_id);

  // Get active scenario with all KPIs
  const { data: scenario, error } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("*")
    .eq("development_id", projectId)
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar cenário: ${error.message}`);
  if (!scenario) return { error: "Nenhuma simulação encontrada. Rode uma simulação financeira primeiro." };

  const s = scenario as Record<string, unknown>;
  if (!s.is_calculated) return { error: "Cenário não calculado. Rode a simulação primeiro." };

  const vpl = Number(s.vpl) || 0;
  const tirAnual = Number(s.tir_anual) || 0;
  const payback = Number(s.payback_meses) || 999;
  const margem = Number(s.margem_liquida) || 0;
  const score = Number(s.performance_score) || 0;
  const breakEvenPct = Number(s.break_even_pct) || 100;
  const custoTotal = Number(s.custo_total) || 0;
  const vgvTotal = Number(s.vgv_total) || 0;
  const qtdLotes = Number(s.qtd_lotes) || 0;
  const precoMedio = Number(s.preco_medio_lote) || 0;
  const custoInfra = Number(s.custo_infra_por_lote) || 0;
  const prazoVendas = Number(s.prazo_vendas_meses) || 0;
  const prazoObras = Number(s.prazo_obras_meses) || 0;

  // Identify weak points and generate suggestions
  interface Suggestion {
    area: string;
    diagnostic: string;
    suggestion: string;
    expected_impact: string;
    priority: number; // lower = more impactful
  }

  const suggestions: Suggestion[] = [];

  // 1. VPL negativo ou baixo
  if (vpl < 0) {
    suggestions.push({
      area: "VPL",
      diagnostic: `VPL negativo (R$ ${(vpl / 1_000).toFixed(0)}k) indica projeto inviável nas premissas atuais.`,
      suggestion: "Aumente o preço médio do lote em 10-15% ou reduza o custo de infraestrutura. Considere renegociar o terreno.",
      expected_impact: "VPL pode ficar positivo, elevando o Score em +15 a +25 pontos.",
      priority: 1,
    });
  } else if (vpl > 0 && vpl < vgvTotal * 0.1) {
    suggestions.push({
      area: "VPL",
      diagnostic: `VPL positivo mas baixo (${((vpl / vgvTotal) * 100).toFixed(1)}% do VGV). Margem de segurança estreita.`,
      suggestion: "Reduza o prazo de vendas em 3-6 meses para antecipar receitas e melhorar o VPL via valor temporal do dinheiro.",
      expected_impact: "Melhoria de 5-10% no VPL, +5 a +10 pontos no Score.",
      priority: 3,
    });
  }

  // 2. TIR baixa
  if (tirAnual < 15) {
    suggestions.push({
      area: "TIR",
      diagnostic: `TIR anual de ${tirAnual.toFixed(1)}% está abaixo do patamar atrativo (15%+). O projeto perde para investimentos alternativos.`,
      suggestion: custoInfra > precoMedio * 0.3
        ? "O custo de infraestrutura por lote é alto (>30% do preço). Reavalie o escopo de obras ou busque materiais mais econômicos."
        : "Aumente o preço médio ou reduza o prazo total do projeto para melhorar a rentabilidade anualizada.",
      expected_impact: "Cada 5% de redução no custo total eleva a TIR em ~2-3 p.p.",
      priority: 2,
    });
  }

  // 3. Payback longo
  if (payback > 48) {
    suggestions.push({
      area: "Payback",
      diagnostic: `Payback de ${payback} meses (${(payback / 12).toFixed(1)} anos) é longo. Investidores preferem < 48 meses.`,
      suggestion: "Antecipe o início das vendas (venda na planta) e aumente a velocidade de vendas nos primeiros 12 meses com ação comercial agressiva.",
      expected_impact: "Antecipar 20% das vendas pode reduzir o payback em 6-12 meses.",
      priority: 2,
    });
  }

  // 4. Margem baixa
  if (margem < 20) {
    suggestions.push({
      area: "Margem Líquida",
      diagnostic: `Margem de ${margem.toFixed(1)}% é apertada (referência: ≥20% para loteamentos).`,
      suggestion: custoTotal > vgvTotal * 0.75
        ? "Custos representam mais de 75% do VGV. Foque em reduzir custos de terraplanagem e infraestrutura — são os maiores drivers."
        : `Aumente o VGV: considere ${qtdLotes > 100 ? "lotes maiores com preço premium" : "adicionar mais lotes ao projeto se a área permitir"}.`,
      expected_impact: "Cada 5% de economia nos custos adiciona ~5 p.p. à margem.",
      priority: 3,
    });
  }

  // 5. Break-even alto
  if (breakEvenPct > 60) {
    suggestions.push({
      area: "Break-Even",
      diagnostic: `Break-even em ${breakEvenPct.toFixed(0)}% dos lotes é alto. Pouca margem de segurança se as vendas desacelerarem.`,
      suggestion: "Reduza custos fixos (terreno, aprovações) ou negocie parcelamento do terreno vinculado às vendas para baixar o ponto de equilíbrio.",
      expected_impact: "Reduzir break-even para <50% aumenta a segurança do projeto e melhora o Score em +5 a +10 pontos.",
      priority: 4,
    });
  }

  // 6. Prazo de obras longo
  if (prazoObras > 24) {
    suggestions.push({
      area: "Prazo de Obras",
      diagnostic: `Prazo de obras de ${prazoObras} meses é extenso. Aumenta exposição a inflação e custo de capital.`,
      suggestion: "Faça a infraestrutura em fases (gleba por gleba) para iniciar vendas mais cedo e reduzir capital exposto.",
      expected_impact: "Faseamento pode reduzir o investimento inicial em 30-40% e melhorar VPL.",
      priority: 5,
    });
  }

  // Sort by priority and take top 3
  suggestions.sort((a, b) => a.priority - b.priority);
  const top3 = suggestions.slice(0, 3);

  // If no issues found (great project!)
  if (top3.length === 0) {
    return {
      score_atual: Math.round(score),
      message: "Projeto com indicadores sólidos! VPL positivo, TIR atrativa, payback adequado e margem saudável. Sem melhorias críticas identificadas.",
      suggestions: [],
    };
  }

  return {
    score_atual: Math.round(score),
    kpis_resumo: {
      vpl: vpl,
      tir_anual: tirAnual,
      payback_meses: payback,
      margem_liquida: margem,
      break_even_pct: breakEvenPct,
    },
    suggestions: top3.map((s, i) => ({
      rank: i + 1,
      area: s.area,
      diagnostic: s.diagnostic,
      suggestion: s.suggestion,
      expected_impact: s.expected_impact,
    })),
    total_issues_found: suggestions.length,
  };
}

// ─── US-102: Execute Actions ───

async function executeSimulateParcelamento(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const scenarioId = String(args.scenario_id);
  const scenarioType = String(args.scenario_type || "realista");

  // Get BEFORE KPIs
  const { data: before, error: bErr } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("vpl, tir_anual, payback_meses, performance_score, vgv_total, custo_total, margem_liquida, break_even_pct, is_calculated, tenant_id")
    .eq("id", scenarioId)
    .maybeSingle();

  if (bErr) throw new Error(`Erro ao buscar cenário: ${bErr.message}`);
  if (!before) return { error: "Cenário não encontrado." };
  if ((before as Record<string, unknown>).tenant_id !== ctx.tenantId) return { error: "Acesso negado." };

  const beforeKpis = before as Record<string, unknown>;

  // Call parcelamento-financial-calc EF
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const calcResp = await fetch(`${SUPABASE_URL}/functions/v1/parcelamento-financial-calc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      action: "simulate",
      scenario_id: scenarioId,
      scenario_type: scenarioType,
    }),
  });

  if (!calcResp.ok) {
    const errText = await calcResp.text();
    console.error("[Copilot] simulate error:", errText);
    return { error: `Erro ao simular: ${calcResp.status}. Verifique se o cenário tem premissas válidas.` };
  }

  const calcResult = await calcResp.json();
  if (!calcResult.ok) {
    return { error: calcResult.error || "Simulação falhou." };
  }

  const afterKpis = calcResult.kpis || {};

  // Build delta comparison
  const delta = (key: string, label: string, format: "currency" | "pct" | "months" | "score") => {
    const b = Number(beforeKpis[key]) || 0;
    const a = Number(afterKpis[key]) || 0;
    const diff = a - b;
    return { metric: label, before: b, after: a, delta: diff, improved: format === "months" ? diff < 0 : diff > 0 };
  };

  return {
    success: true,
    financial_id: calcResult.financial_id,
    scenario_type: scenarioType,
    kpis_comparison: [
      delta("vpl", "VPL (R$)", "currency"),
      delta("tir_anual", "TIR Anual (%)", "pct"),
      delta("payback_meses", "Payback (meses)", "months"),
      delta("margem_liquida", "Margem Líquida (%)", "pct"),
      delta("performance_score", "Performance Score", "score"),
    ],
    kpis_after: afterKpis,
    was_previously_calculated: beforeKpis.is_calculated,
    message: "Simulação concluída! Veja a comparação dos KPIs antes × depois.",
  };
}

async function executeUpdateParcelamentoPremises(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const scenarioId = String(args.scenario_id);
  const updates = (args.updates || {}) as Record<string, unknown>;

  // Validate scenario belongs to tenant
  const { data: scenario, error: sErr } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("id, scenario_name, tenant_id, qtd_lotes, preco_medio_lote, custo_infra_por_lote, custo_terreno, taxa_desconto_mensal, prazo_vendas_meses, prazo_obras_meses")
    .eq("id", scenarioId)
    .maybeSingle();

  if (sErr) throw new Error(`Erro ao buscar cenário: ${sErr.message}`);
  if (!scenario) return { error: "Cenário não encontrado." };
  if ((scenario as Record<string, unknown>).tenant_id !== ctx.tenantId) return { error: "Acesso negado." };

  const s = scenario as Record<string, unknown>;

  // Whitelist allowed fields
  const ALLOWED_FIELDS = ["qtd_lotes", "preco_medio_lote", "custo_infra_por_lote", "custo_terreno", "taxa_desconto_mensal", "prazo_vendas_meses", "prazo_obras_meses", "scenario_name"];
  const safeUpdates: Record<string, unknown> = {};
  const changes: { field: string; from: unknown; to: unknown }[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_FIELDS.includes(key) && value !== undefined && value !== null) {
      if (key === "scenario_name") {
        safeUpdates[key] = String(value);
      } else {
        const numVal = Number(value);
        if (isNaN(numVal)) return { error: `Valor inválido para ${key}: "${value}" não é um número.` };
        if (numVal < 0) return { error: `Valor inválido para ${key}: não pode ser negativo.` };
        safeUpdates[key] = numVal;
      }
      changes.push({ field: key, from: s[key], to: safeUpdates[key] });
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return { error: "Nenhum campo válido para atualizar. Campos aceitos: " + ALLOWED_FIELDS.join(", ") };
  }

  // Mark as not calculated (needs re-simulation)
  safeUpdates.is_calculated = false;
  safeUpdates.updated_at = new Date().toISOString();

  const { error: uErr } = await ctx.supabase
    .from("development_parcelamento_scenarios")
    .update(safeUpdates)
    .eq("id", scenarioId)
    .eq("tenant_id", ctx.tenantId);

  if (uErr) throw new Error(`Erro ao atualizar premissas: ${uErr.message}`);

  return {
    success: true,
    scenario_id: scenarioId,
    changes,
    needs_simulation: true,
    message: `${changes.length} premissa(s) atualizada(s). O cenário precisa ser re-simulado para atualizar os KPIs. Deseja que eu rode a simulação agora?`,
  };
}

// ─── US-106: Análise Preditiva ───

async function executePredictViability(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const city = String(args.city || "");
  const state = String(args.state || "").toUpperCase();
  const areaTotalM2 = Number(args.area_total_m2) || 0;
  const tipo = String(args.tipo_empreendimento || "aberto");

  if (!city || !state || areaTotalM2 <= 0) {
    return { error: "Parâmetros obrigatórios: city, state, area_total_m2 (>0)." };
  }

  // Regional benchmarks (heurísticas baseadas em dados de mercado brasileiro)
  const BENCHMARKS: Record<string, { preco_m2_min: number; preco_m2_med: number; preco_m2_max: number; custo_infra_m2: number }> = {
    SP: { preco_m2_min: 350, preco_m2_med: 600, preco_m2_max: 1200, custo_infra_m2: 180 },
    RJ: { preco_m2_min: 300, preco_m2_med: 500, preco_m2_max: 1000, custo_infra_m2: 170 },
    MG: { preco_m2_min: 200, preco_m2_med: 400, preco_m2_max: 800, custo_infra_m2: 140 },
    PR: { preco_m2_min: 250, preco_m2_med: 450, preco_m2_max: 900, custo_infra_m2: 150 },
    SC: { preco_m2_min: 300, preco_m2_med: 500, preco_m2_max: 950, custo_infra_m2: 160 },
    RS: { preco_m2_min: 200, preco_m2_med: 380, preco_m2_max: 750, custo_infra_m2: 140 },
    GO: { preco_m2_min: 180, preco_m2_med: 350, preco_m2_max: 700, custo_infra_m2: 130 },
    MS: { preco_m2_min: 180, preco_m2_med: 350, preco_m2_max: 650, custo_infra_m2: 125 },
    BA: { preco_m2_min: 150, preco_m2_med: 300, preco_m2_max: 600, custo_infra_m2: 120 },
    DEFAULT: { preco_m2_min: 150, preco_m2_med: 300, preco_m2_max: 600, custo_infra_m2: 120 },
  };

  const bench = BENCHMARKS[state] || BENCHMARKS.DEFAULT;

  // Use user-provided price or benchmark
  const precoM2 = Number(args.preco_m2_estimado) || bench.preco_m2_med;
  const custoInfraM2 = bench.custo_infra_m2;

  // Estimate lots (35% área útil for aberto, 40% for fechado)
  const areaUtilPct = tipo === "fechado" ? 0.40 : 0.35;
  const areaMediaLote = tipo === "fechado" ? 360 : 250; // m²
  const qtdLotes = Number(args.qtd_lotes_estimada) || Math.floor((areaTotalM2 * areaUtilPct) / areaMediaLote);

  if (qtdLotes < 5) {
    return { error: "Área insuficiente para um loteamento viável (estimativa < 5 lotes)." };
  }

  // Financial estimates per scenario
  const estimate = (precoMultiplier: number, custoMultiplier: number, vendaMultiplier: number) => {
    const preco = precoM2 * precoMultiplier;
    const vgv = qtdLotes * areaMediaLote * preco;
    const custoInfra = qtdLotes * areaMediaLote * custoInfraM2 * custoMultiplier;
    const custoTerreno = areaTotalM2 * preco * 0.15; // ~15% do preço do m²
    const custoTotal = custoInfra + custoTerreno + vgv * 0.08; // 8% despesas gerais
    const lucro = vgv - custoTotal;
    const margem = vgv > 0 ? (lucro / vgv) * 100 : 0;
    const prazoVendas = Math.ceil(qtdLotes / (qtdLotes * 0.03 * vendaMultiplier)); // 3% absorção/mês base
    const prazoObras = Math.max(12, Math.ceil(qtdLotes / 15)); // ~15 lotes/mês infra

    // Simplified VPL (monthly discount rate 1%)
    const taxaDesc = 0.01;
    let vpl = -custoTerreno; // Investimento inicial
    const receitaMensal = vgv / prazoVendas;
    const custoMensal = custoInfra / prazoObras;
    for (let m = 1; m <= Math.max(prazoVendas, prazoObras); m++) {
      const receita = m <= prazoVendas ? receitaMensal : 0;
      const custo = m <= prazoObras ? custoMensal : 0;
      vpl += (receita - custo) / Math.pow(1 + taxaDesc, m);
    }

    // Simplified TIR estimate (heuristic)
    const tirAnual = margem > 0 ? Math.min(margem * 0.8, 60) : margem * 0.5;

    // Performance score estimate
    const scoreVpl = vpl > 0 ? Math.min(25, (vpl / vgv) * 100) : 0;
    const scoreTir = Math.min(25, (Math.max(0, tirAnual) / 30) * 25);
    const scorePayback = prazoVendas <= 36 ? 20 : prazoVendas <= 48 ? 15 : prazoVendas <= 60 ? 10 : 5;
    const scoreMargem = Math.min(20, (Math.max(0, margem) / 40) * 20);
    const score = Math.round(scoreVpl + scoreTir + scorePayback + scoreMargem + 10); // +10 base

    return {
      vgv: Math.round(vgv),
      custo_total: Math.round(custoTotal),
      lucro: Math.round(lucro),
      margem: +margem.toFixed(1),
      vpl: Math.round(vpl),
      tir_anual_estimada: +tirAnual.toFixed(1),
      payback_meses: prazoVendas,
      performance_score: Math.min(100, Math.max(0, score)),
    };
  };

  const pessimista = estimate(0.85, 1.20, 0.70);
  const realista = estimate(1.0, 1.0, 1.0);
  const otimista = estimate(1.15, 0.85, 1.30);

  return {
    prediction_type: "heuristic_v1",
    confidence_note: "Estimativa baseada em benchmarks regionais. Precisão melhor com dados reais do terreno e simulação completa.",
    inputs: {
      city,
      state,
      area_total_m2: areaTotalM2,
      qtd_lotes_estimada: qtdLotes,
      area_media_lote_m2: areaMediaLote,
      preco_m2_usado: precoM2,
      tipo_empreendimento: tipo,
      benchmark_regional: bench,
    },
    scenarios: {
      pessimista,
      realista,
      otimista,
    },
    verdict: realista.vpl > 0 && realista.tir_anual_estimada > 12
      ? "✅ VIÁVEL — Indicadores positivos no cenário realista."
      : realista.vpl > 0
        ? "⚠️ MARGINAL — VPL positivo mas TIR baixa. Aprofunde a análise."
        : "❌ INVIÁVEL nas premissas estimadas. Revise preço, custos ou escopo.",
    recommendation: "Para uma análise precisa, cadastre o projeto e rode a simulação financeira completa com premissas detalhadas.",
  };
}

// ─── US-108: Comparador de Cenários ───

async function executeCompareParcelamentoScenarios(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.project_id);
  const scenarioIds = Array.isArray(args.scenario_ids) ? args.scenario_ids.map(String) : [];

  // Fetch scenarios
  let query = ctx.supabase
    .from("development_parcelamento_scenarios")
    .select("id, scenario_name, is_active, is_calculated, vpl, tir_anual, payback_meses, performance_score, vgv_total, custo_total, lucro_liquido, margem_liquida, qtd_lotes, preco_medio_lote, custo_infra_por_lote, custo_terreno, prazo_vendas_meses, prazo_obras_meses, break_even_pct, break_even_units, created_at")
    .eq("development_id", projectId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });

  if (scenarioIds.length > 0) {
    query = query.in("id", scenarioIds);
  }

  const { data, error } = await query.limit(5);
  if (error) throw new Error(`Erro ao buscar cenários: ${error.message}`);
  if (!data || data.length < 2) {
    return { error: `Necessário pelo menos 2 cenários para comparar. Encontrado: ${data?.length || 0}.` };
  }

  const scenarios = data as Record<string, unknown>[];

  // Build comparison table
  const metrics = [
    { key: "vpl", label: "VPL (R$)", higherBetter: true },
    { key: "tir_anual", label: "TIR Anual (%)", higherBetter: true },
    { key: "payback_meses", label: "Payback (meses)", higherBetter: false },
    { key: "performance_score", label: "Performance Score", higherBetter: true },
    { key: "vgv_total", label: "VGV Total (R$)", higherBetter: true },
    { key: "custo_total", label: "Custo Total (R$)", higherBetter: false },
    { key: "margem_liquida", label: "Margem Líquida (%)", higherBetter: true },
    { key: "break_even_pct", label: "Break-Even (%)", higherBetter: false },
    { key: "qtd_lotes", label: "Qtd Lotes", higherBetter: true },
    { key: "preco_medio_lote", label: "Preço Médio/Lote (R$)", higherBetter: true },
  ];

  const comparison = metrics.map((m) => {
    const values = scenarios.map((s) => ({
      scenario: String(s.scenario_name || s.id),
      value: Number(s[m.key]) || 0,
    }));

    const sorted = [...values].sort((a, b) => m.higherBetter ? b.value - a.value : a.value - b.value);
    const best = sorted[0]?.scenario;

    return {
      metric: m.label,
      values: Object.fromEntries(values.map((v) => [v.scenario, v.value])),
      best_scenario: best,
    };
  });

  // Overall recommendation (score-based)
  const scored = scenarios.map((s) => ({
    name: String(s.scenario_name || s.id),
    id: s.id,
    score: Number(s.performance_score) || 0,
    is_active: s.is_active,
    is_calculated: s.is_calculated,
  }));
  scored.sort((a, b) => b.score - a.score);

  return {
    total_scenarios: scenarios.length,
    scenarios_summary: scored,
    comparison,
    recommendation: {
      best_overall: scored[0]?.name,
      best_score: scored[0]?.score,
      reason: `"${scored[0]?.name}" tem o maior Performance Score (${scored[0]?.score}/100), indicando o melhor equilíbrio entre rentabilidade, risco e prazo.`,
    },
  };
}

// ─── US-109: Detector de Red Flags ───

async function executeDetectRedFlags(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const projectId = String(args.project_id);

  // Gather all project data in parallel
  const [projectRes, scenarioRes, complianceRes] = await Promise.all([
    ctx.supabase
      .from("development_parcelamento")
      .select("id, name, status, total_units, vgv_estimado, area_total_m2, city, state, created_at")
      .eq("id", projectId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    ctx.supabase
      .from("development_parcelamento_scenarios")
      .select("*")
      .eq("development_id", projectId)
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .maybeSingle(),
    ctx.supabase
      .from("parcelamento_legal_analyses")
      .select("compliance_score, checklist_6766, checklist_4591, missing_info")
      .eq("development_id", projectId)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (projectRes.error) throw new Error(`Erro: ${projectRes.error.message}`);
  if (!projectRes.data) return { error: "Projeto não encontrado." };

  const project = projectRes.data as Record<string, unknown>;
  const scenario = scenarioRes.data as Record<string, unknown> | null;
  const compliance = complianceRes.data as Record<string, unknown> | null;

  // Deterministic red flag analysis
  interface RedFlag {
    severity: "critico" | "alto" | "medio" | "baixo";
    category: string;
    flag: string;
    explanation: string;
    action: string;
    priority: number;
  }

  const flags: RedFlag[] = [];

  if (scenario && scenario.is_calculated) {
    const vpl = Number(scenario.vpl) || 0;
    const tirAnual = Number(scenario.tir_anual) || 0;
    const payback = Number(scenario.payback_meses) || 999;
    const margem = Number(scenario.margem_liquida) || 0;
    const score = Number(scenario.performance_score) || 0;
    const breakEvenPct = Number(scenario.break_even_pct) || 100;
    const custoTotal = Number(scenario.custo_total) || 0;
    const vgvTotal = Number(scenario.vgv_total) || 0;
    const custoInfra = Number(scenario.custo_infra_por_lote) || 0;
    const precoMedio = Number(scenario.preco_medio_lote) || 0;
    const prazoVendas = Number(scenario.prazo_vendas_meses) || 0;
    const prazoObras = Number(scenario.prazo_obras_meses) || 0;
    const taxaDesc = Number(scenario.taxa_desconto_mensal) || 0;

    // CRITICAL: VPL negativo
    if (vpl < 0) {
      flags.push({
        severity: "critico",
        category: "Financeiro",
        flag: "VPL negativo — projeto destrói valor",
        explanation: `VPL de R$ ${(vpl / 1000).toFixed(0)}k. O projeto não remunera o capital investido na taxa de desconto atual (${(taxaDesc * 100).toFixed(2)}%/mês).`,
        action: "Revise premissas de preço, custos e prazo antes de prosseguir. Considere não investir.",
        priority: 1,
      });
    }

    // CRITICAL: Score < 30
    if (score < 30) {
      flags.push({
        severity: "critico",
        category: "Performance",
        flag: "Performance Score crítico (<30)",
        explanation: `Score ${Math.round(score)}/100 indica múltiplos indicadores financeiros fora da faixa saudável.`,
        action: "Reavalie a viabilidade completa do projeto. Múltiplos ajustes serão necessários.",
        priority: 1,
      });
    }

    // HIGH: Margem < 15%
    if (margem < 15 && margem >= 0) {
      flags.push({
        severity: "alto",
        category: "Financeiro",
        flag: `Margem apertada (${margem.toFixed(1)}%)`,
        explanation: `Margem inferior a 15% deixa pouca reserva para imprevistos. Loteamentos saudáveis operam com 20-35%.`,
        action: "Reduza custos ou aumente o preço médio para atingir margem ≥20%.",
        priority: 2,
      });
    }

    // HIGH: Break-even > 70%
    if (breakEvenPct > 70) {
      flags.push({
        severity: "alto",
        category: "Risco",
        flag: `Break-even alto (${breakEvenPct.toFixed(0)}% dos lotes)`,
        explanation: "Precisa vender mais de 70% dos lotes para empatar. Risco alto se o mercado desacelerar.",
        action: "Negocie parcelamento do terreno atrelado a vendas ou reduza custos fixos.",
        priority: 2,
      });
    }

    // HIGH: Payback > 60 meses
    if (payback > 60) {
      flags.push({
        severity: "alto",
        category: "Financeiro",
        flag: `Payback muito longo (${payback} meses / ${(payback / 12).toFixed(1)} anos)`,
        explanation: "Investidores tipicamente exigem retorno em até 48 meses para loteamentos. Acima de 60 meses é difícil captar investimento.",
        action: "Antecipe vendas, faça obras em fases, ou reduza investimento inicial.",
        priority: 3,
      });
    }

    // MEDIUM: Custo infra > 40% do preço
    if (precoMedio > 0 && custoInfra / precoMedio > 0.40) {
      flags.push({
        severity: "medio",
        category: "Custos",
        flag: `Custo de infraestrutura desproporcional (${((custoInfra / precoMedio) * 100).toFixed(0)}% do preço/lote)`,
        explanation: "Infraestrutura consome mais de 40% do preço do lote. Referência saudável: 20-30%.",
        action: "Reavalie escopo de infra (pavimentação, rede elétrica) ou busque terreno com topografia mais favorável.",
        priority: 4,
      });
    }

    // MEDIUM: Prazo obras > prazo vendas
    if (prazoObras > prazoVendas && prazoVendas > 0) {
      flags.push({
        severity: "medio",
        category: "Cronograma",
        flag: "Obras mais longas que vendas",
        explanation: `Prazo de obras (${prazoObras}m) excede o prazo de vendas (${prazoVendas}m). Risco de ter lotes vendidos sem infraestrutura pronta.`,
        action: "Faseie as obras alinhadas com as vendas por etapa/quadra.",
        priority: 4,
      });
    }

    // LOW: TIR < SELIC
    if (tirAnual > 0 && tirAnual < 12) {
      flags.push({
        severity: "baixo",
        category: "Rentabilidade",
        flag: `TIR inferior à SELIC (${tirAnual.toFixed(1)}% vs ~12%)`,
        explanation: "O projeto rende menos que a taxa básica de juros. O investidor ganharia mais no CDI.",
        action: "Projeto não é atrativo como investimento puro. Pode fazer sentido estratégico mas não financeiro.",
        priority: 5,
      });
    }

    // LOW: Pouca diversificação de cenários
    const { data: allScenarios } = await ctx.supabase
      .from("development_parcelamento_scenarios")
      .select("id")
      .eq("development_id", projectId)
      .eq("tenant_id", ctx.tenantId);

    if ((allScenarios?.length || 0) < 2) {
      flags.push({
        severity: "baixo",
        category: "Análise",
        flag: "Apenas 1 cenário simulado",
        explanation: "Sem cenários alternativos (otimista/pessimista), é impossível avaliar a sensibilidade do projeto.",
        action: "Crie pelo menos 3 cenários (pessimista, realista, otimista) para entender o range de resultados.",
        priority: 6,
      });
    }
  } else {
    flags.push({
      severity: "alto",
      category: "Análise",
      flag: "Sem simulação financeira",
      explanation: "Projeto não tem simulação financeira calculada. Impossível avaliar viabilidade.",
      action: "Rode a simulação financeira antes de tomar qualquer decisão de investimento.",
      priority: 1,
    });
  }

  // Compliance red flags
  if (compliance) {
    const complianceScore = Number(compliance.compliance_score) || 0;
    if (complianceScore < 50) {
      flags.push({
        severity: "critico",
        category: "Legal",
        flag: `Compliance score crítico (${complianceScore}/100)`,
        explanation: "Menos da metade dos requisitos legais (Lei 6.766 / Lei 4.591) estão em conformidade. Risco de embargo.",
        action: "Resolva pendências legais ANTES de investir em infraestrutura ou iniciar vendas.",
        priority: 1,
      });
    } else if (complianceScore < 80) {
      flags.push({
        severity: "medio",
        category: "Legal",
        flag: `Pendências legais (compliance ${complianceScore}/100)`,
        explanation: "Há itens pendentes na conformidade legal que podem atrasar aprovações.",
        action: "Revise os itens pendentes na aba Conformidade e resolva antes do lançamento.",
        priority: 3,
      });
    }

    const missingInfo = compliance.missing_info;
    if (missingInfo && Array.isArray(missingInfo) && missingInfo.length > 3) {
      flags.push({
        severity: "medio",
        category: "Documentação",
        flag: `${(missingInfo as unknown[]).length} documentos/informações faltantes`,
        explanation: "A análise legal identificou múltiplas informações faltantes que impedem avaliação completa.",
        action: "Forneça os documentos listados na seção 'Informações Faltantes' da conformidade.",
        priority: 4,
      });
    }
  } else {
    flags.push({
      severity: "medio",
      category: "Legal",
      flag: "Sem análise legal",
      explanation: "Projeto não tem análise de conformidade legal. Riscos jurídicos não avaliados.",
      action: "Rode a análise de conformidade na aba 'Conformidade Legal'.",
      priority: 3,
    });
  }

  // Sort by priority
  flags.sort((a, b) => a.priority - b.priority);

  const criticalCount = flags.filter((f) => f.severity === "critico").length;
  const highCount = flags.filter((f) => f.severity === "alto").length;

  return {
    project_name: project.name,
    total_flags: flags.length,
    by_severity: {
      critico: criticalCount,
      alto: highCount,
      medio: flags.filter((f) => f.severity === "medio").length,
      baixo: flags.filter((f) => f.severity === "baixo").length,
    },
    risk_level: criticalCount > 0 ? "CRÍTICO" : highCount > 0 ? "ALTO" : flags.length > 3 ? "MODERADO" : "BAIXO",
    flags: flags.slice(0, 8), // Max 8 flags
    summary: criticalCount > 0
      ? `⚠️ ${criticalCount} risco(s) CRÍTICO(s) identificado(s). Resolva antes de prosseguir com o investimento.`
      : highCount > 0
        ? `🟡 ${highCount} risco(s) ALTO(s). Atenção redobrada necessária antes do lançamento.`
        : "🟢 Nenhum risco crítico ou alto. Projeto em boas condições, mas revise os itens médios/baixos.",
  };
}

// ─── Bloco H: Regulações Brasil (Sessão 141) ───

async function executeCalcItbi(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/brazil-regulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ action: "calc_itbi", development_id: args.development_id, aliquota_override_pct: args.aliquota_override_pct }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao calcular ITBI: ${err}` };
  }
  return resp.json();
}

async function executeCalcOutorga(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/brazil-regulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      action: "calc_outorga",
      development_id: args.development_id,
      area_construida_m2: args.area_construida_m2,
      valor_m2_terreno: args.valor_m2_terreno,
      coeficiente_utilizado: args.coeficiente_utilizado,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao calcular Outorga: ${err}` };
  }
  return resp.json();
}

async function executeCheckLeiVerde(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/brazil-regulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      action: "check_lei_verde",
      development_id: args.development_id,
      bioma: args.bioma,
      area_verde_m2: args.area_verde_m2,
      area_permeavel_m2: args.area_permeavel_m2,
      extensao_vias_m: args.extensao_vias_m,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao verificar Lei do Verde: ${err}` };
  }
  return resp.json();
}

async function executeValidateCnpjSpe(_ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/brazil-regulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ action: "validate_cnpj_spe", cnpj: args.cnpj }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao validar CNPJ: ${err}` };
  }
  return resp.json();
}

// ─── Bloco H Sprint 2: Benchmarks de Mercado (Sessão 142) ───

async function executeFetchSinapi(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/market-benchmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      action: "fetch_sinapi",
      uf: args.uf,
      codigo: args.codigo,
      busca: args.busca,
      grupo: args.grupo,
      limit: args.limit,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao consultar SINAPI: ${err}` };
  }
  return resp.json();
}

async function executeFetchSecovi(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/market-benchmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      action: "fetch_secovi",
      cidade: args.cidade,
      uf: args.uf,
      tipo_imovel: args.tipo_imovel,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao consultar SECOVI: ${err}` };
  }
  return resp.json();
}

async function executeFetchAbrainc(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/market-benchmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      action: "fetch_abrainc",
      regiao: args.regiao,
      uf: args.uf,
      segmento: args.segmento,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { error: `Erro ao consultar ABRAINC: ${err}` };
  }
  return resp.json();
}

// ─── Module 9: Censo IBGE (Sessão 143) ───

async function executeFetchCensusIncome(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/ibge-census`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "fetch_census_income", municipio: args.municipio, uf: args.uf, classe: args.classe }),
  });

  if (!resp.ok) return { error: `Erro ao consultar IBGE renda: ${await resp.text()}` };
  return resp.json();
}

async function executeFetchCensusDemographics(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/ibge-census`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "fetch_census_demographics", municipio: args.municipio, uf: args.uf }),
  });

  if (!resp.ok) return { error: `Erro ao consultar IBGE demografia: ${await resp.text()}` };
  return resp.json();
}

async function executeFetchCensusHousing(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/ibge-census`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "fetch_census_housing", municipio: args.municipio, uf: args.uf }),
  });

  if (!resp.ok) return { error: `Erro ao consultar IBGE domicílios: ${await resp.text()}` };
  return resp.json();
}

// ─── Module 10: Embargos Ambientais (Sessão 143) ───

async function executeCheckIbamaEmbargoes(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/environmental-embargoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "check_ibama_embargoes", lat: args.lat, lng: args.lng, municipio: args.municipio, uf: args.uf, raio_busca_km: args.raio_busca_km, incluir_inativos: args.incluir_inativos }),
  });

  if (!resp.ok) return { error: `Erro ao consultar IBAMA embargos: ${await resp.text()}` };
  return resp.json();
}

async function executeCheckICMBioUCs(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/environmental-embargoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "check_icmbio_embargoes", lat: args.lat, lng: args.lng, municipio: args.municipio, uf: args.uf, raio_busca_km: args.raio_busca_km }),
  });

  if (!resp.ok) return { error: `Erro ao consultar ICMBio UCs: ${await resp.text()}` };
  return resp.json();
}

// ─── Module 12: MapBiomas — Uso e Cobertura do Solo (Sessão 144) ───

async function executeFetchMapBiomasLandUse(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/development-mapbiomas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "fetch_land_use", params: { development_id: args.development_id, year: args.year, buffer_radius_m: args.buffer_radius_m } }),
  });

  if (!resp.ok) return { error: `Erro ao consultar MapBiomas: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.data) {
    // Resumir classes para o copilot (top 5)
    const d = data.data;
    const topClasses = (d.land_use_classes || []).slice(0, 5).map((c: { class_name: string; percentage: number; area_ha: number }) => `${c.class_name}: ${c.percentage}% (${c.area_ha} ha)`);
    return {
      ok: true,
      reference_year: d.reference_year,
      dominant_class: d.dominant_class,
      native_vegetation_pct: d.native_vegetation_pct,
      agriculture_pct: d.agriculture_pct,
      urban_pct: d.urban_pct,
      water_pct: d.water_pct,
      pixel_count: d.pixel_count,
      cached: d.cached,
      top_classes: topClasses,
    };
  }
  return data;
}

async function executeFetchMapBiomasTimeSeries(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/development-mapbiomas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "fetch_time_series", params: { development_id: args.development_id, start_year: args.start_year, end_year: args.end_year, buffer_radius_m: args.buffer_radius_m } }),
  });

  if (!resp.ok) return { error: `Erro ao consultar série temporal MapBiomas: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.data) {
    const d = data.data;
    // Resumir para o copilot
    const yearSummaries = (d.years || []).map((y: { reference_year: number; native_vegetation_pct: number; agriculture_pct: number; urban_pct: number }) =>
      `${y.reference_year}: veg=${y.native_vegetation_pct}% agro=${y.agriculture_pct}% urb=${y.urban_pct}%`
    );
    return {
      ok: true,
      total_years: d.total_years,
      cached_years: d.cached_years,
      trend: d.trend,
      year_summaries: yearSummaries,
    };
  }
  return data;
}

// ─── Module 11: Exportação DXF (Sessão 143) ───

async function executeGenerateDxfProject(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/urbanistic-project-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action: "generate_dxf", development_id: args.development_id, convert_to_dwg: args.convert_to_dwg }),
  });

  if (!resp.ok) return { error: `Erro ao gerar DXF: ${await resp.text()}` };
  // Para o copilot, retornamos apenas o resumo (não o base64 inteiro)
  const data = await resp.json();
  if (data?.ok && data?.data) {
    const { dxf, layout_summary, layers, nota } = data.data;
    return { ok: true, data: { filename: dxf.filename, size_bytes: dxf.size_bytes, format: dxf.format, layout_summary, layers, nota, download_disponivel: true } };
  }
  return data;
}

// ─── Module 13: Memorial Descritivo (Sessão 145) ───

async function executeGenerateMemorialDescritivo(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/memorial-descritivo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "generate",
      params: {
        development_id: args.development_id,
        property_name: args.property_name,
        owner_name: args.owner_name,
        registration_number: args.registration_number,
        municipality: args.municipality,
        state: args.state,
        area_total_m2: args.area_total_m2,
        perimeter_m: args.perimeter_m,
        vertices: args.vertices,
        boundaries: args.boundaries,
        datum: args.datum,
      },
    }),
  });

  if (!resp.ok) return { error: `Erro ao gerar memorial descritivo: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.data) {
    return { ok: true, memorial_id: data.data.id, status: data.data.status, property_name: data.data.property_name, area_total_m2: data.data.area_total_m2, num_vertices: data.data.vertices?.length || 0, created_at: data.data.created_at };
  }
  return data;
}

async function executeListMemorialDescritivos(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/memorial-descritivo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "list_memorials",
      params: { development_id: args.development_id, limit: args.limit },
    }),
  });

  if (!resp.ok) return { error: `Erro ao listar memoriais: ${await resp.text()}` };
  return resp.json();
}

// ─── Module 14: Zoneamento Municipal (Sessão 145) ───

async function executeAnalyzeZoneamentoPdf(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/zoneamento-municipal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "analyze_pdf",
      params: {
        development_id: args.development_id,
        pdf_url: args.pdf_url,
        municipality: args.municipality,
        state: args.state,
      },
    }),
  });

  if (!resp.ok) return { error: `Erro ao analisar zoneamento PDF: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.data) {
    const d = data.data;
    return { ok: true, zona: d.zona_classificacao, ca_basico: d.ca_basico, ca_maximo: d.ca_maximo, to_percentual: d.to_percentual, gabarito_andares: d.gabarito_andares, recuo_frontal_m: d.recuo_frontal_m, permeabilidade_percentual: d.permeabilidade_percentual, confidence: d.confidence_score, status: d.status };
  }
  return data;
}

async function executeGetZoneamento(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/zoneamento-municipal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "get_zoning",
      params: { development_id: args.development_id },
    }),
  });

  if (!resp.ok) return { error: `Erro ao buscar zoneamento: ${await resp.text()}` };
  return resp.json();
}

// ─── Module 15: CRI Matrícula (Sessão 145) ───

async function executeRegisterCriMatricula(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/cri-matricula`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "register_matricula",
      params: {
        development_id: args.development_id,
        numero_matricula: args.numero_matricula,
        cartorio: args.cartorio,
        comarca: args.comarca,
        uf: args.uf,
        data_abertura: args.data_abertura,
        proprietario: args.proprietario,
        area_total_m2: args.area_total_m2,
        averbacoes: args.averbacoes,
        onus: args.onus,
      },
    }),
  });

  if (!resp.ok) return { error: `Erro ao registrar matrícula: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.data) {
    return { ok: true, matricula_id: data.data.id, numero: data.data.numero_matricula, cartorio: data.data.cartorio, status: data.data.status, proprietario: data.data.proprietario };
  }
  return data;
}

async function executeListCriMatriculas(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/cri-matricula`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "list_matriculas",
      params: { development_id: args.development_id, limit: args.limit },
    }),
  });

  if (!resp.ok) return { error: `Erro ao listar matrículas: ${await resp.text()}` };
  return resp.json();
}

// ─── Module 16: FII/CRA Simulator (Sessão 145) ───

async function executeSimulateFii(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/fii-cra-simulator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "simulate_fii",
      development_id: args.development_id,
      vgv_total: args.vgv_total,
      expected_monthly_revenue: args.expected_monthly_revenue,
      vacancy_rate_pct: args.vacancy_rate_pct,
      admin_fee_pct: args.admin_fee_pct,
      management_fee_pct: args.management_fee_pct,
      number_of_quotas: args.number_of_quotas,
      expected_yield_annual_pct: args.expected_yield_annual_pct,
      duration_years: args.duration_years,
      discount_rate_annual_pct: args.discount_rate_annual_pct,
    }),
  });

  if (!resp.ok) return { error: `Erro ao simular FII: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.ok && data?.data) {
    const d = data.data;
    return { ok: true, fii_id: d.fii_id, quota_value: d.quota_value, monthly_distribution: d.monthly_distribution_per_quota, annual_yield_pct: d.annual_yield_pct, dividend_yield_pct: d.dividend_yield_pct, irr_5y: d.irr_projection_5years_pct, irr_10y: d.irr_projection_10years_pct, break_even_months: d.break_even_months, summary: d.summary };
  }
  return data;
}

async function executeSimulateCriCra(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const resp = await fetch(`${supabaseUrl}/functions/v1/fii-cra-simulator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      action: "simulate_cri_cra",
      development_id: args.development_id,
      total_receivables: args.total_receivables,
      duration_months: args.duration_months,
      spread_over_cdi_pct: args.spread_over_cdi_pct,
      subordination_level_pct: args.subordination_level_pct,
      credit_enhancement_type: args.credit_enhancement_type,
      credit_enhancement_value: args.credit_enhancement_value,
      expected_default_rate_pct: args.expected_default_rate_pct,
      tax_rate_pct: args.tax_rate_pct,
    }),
  });

  if (!resp.ok) return { error: `Erro ao simular CRI/CRA: ${await resp.text()}` };
  const data = await resp.json();
  if (data?.ok && data?.data) {
    const d = data.data;
    return { ok: true, simulation_id: d.simulation_id, total_receivables: d.total_receivables, duration_months: d.duration_months, senior_rate: d.senior_tranche?.taxa_anual_pct, subordinated_rate: d.subordinated_tranche?.taxa_anual_pct, effective_rate: d.effective_rate_annual_pct, wal_months: d.weighted_average_life_months, irr_senior: d.irr_senior_pct, irr_sub: d.irr_subordinada_pct, summary: d.summary };
  }
  return data;
}

// Router
async function executeTool(ctx: ToolContext, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case "search_contracts": return executeSearchContracts(ctx, args);
    case "get_contract_details": return executeGetContractDetails(ctx, args);
    case "transition_contract_status": return executeTransitionContractStatus(ctx, args);
    case "get_contract_summary": return executeGetContractSummary(ctx);
    case "list_overdue_obligations": return executeListOverdueObligations(ctx, args);
    case "list_upcoming_obligations": return executeListUpcomingObligations(ctx, args);
    case "list_unread_notifications": return executeListUnreadNotifications(ctx, args);
    case "create_notification": return executeCreateNotification(ctx, args);
    case "create_contract": return executeCreateContract(ctx, args);
    case "prefill_contract_form": return executePrefillContractForm(ctx, args);
    case "search_properties": return executeSearchProperties(ctx, args);
    case "search_people": return executeSearchPeople(ctx, args);
    // Parcelamento de Solo
    case "list_parcelamento_projects": return executeListParcelamentoProjects(ctx, args);
    case "get_parcelamento_financial": return executeGetParcelamentoFinancial(ctx, args);
    case "get_parcelamento_scenarios": return executeGetParcelamentoScenarios(ctx, args);
    case "get_deep_premises": return executeGetDeepPremises(ctx, args);
    case "get_parcelamento_compliance": return executeGetParcelamentoCompliance(ctx, args);
    case "suggest_score_improvements": return executeSuggestScoreImprovements(ctx, args);
    // US-102: Execute Actions
    case "simulate_parcelamento": return executeSimulateParcelamento(ctx, args);
    case "update_parcelamento_premises": return executeUpdateParcelamentoPremises(ctx, args);
    // US-106: Análise Preditiva
    case "predict_viability": return executePredictViability(ctx, args);
    // US-108: Comparador de Cenários
    case "compare_parcelamento_scenarios": return executeCompareParcelamentoScenarios(ctx, args);
    // US-109: Detector de Red Flags
    case "detect_red_flags": return executeDetectRedFlags(ctx, args);
    // ─── Bloco H: Regulações Brasil (Sessão 141) ───
    case "calc_itbi": return executeCalcItbi(ctx, args);
    case "calc_outorga": return executeCalcOutorga(ctx, args);
    case "check_lei_verde": return executeCheckLeiVerde(ctx, args);
    case "validate_cnpj_spe": return executeValidateCnpjSpe(ctx, args);
    // ─── Bloco H Sprint 2: Benchmarks de Mercado (Sessão 142) ───
    case "fetch_sinapi": return executeFetchSinapi(ctx, args);
    case "fetch_secovi": return executeFetchSecovi(ctx, args);
    case "fetch_abrainc": return executeFetchAbrainc(ctx, args);
    // ─── Bloco H Sprint 3: Censo IBGE (Sessão 143) ───
    case "fetch_census_income": return executeFetchCensusIncome(ctx, args);
    case "fetch_census_demographics": return executeFetchCensusDemographics(ctx, args);
    case "fetch_census_housing": return executeFetchCensusHousing(ctx, args);
    // ─── Bloco H Sprint 3: Embargos Ambientais (Sessão 143) ───
    case "check_ibama_embargoes": return executeCheckIbamaEmbargoes(ctx, args);
    case "check_icmbio_ucs": return executeCheckICMBioUCs(ctx, args);
    // ─── Bloco H Sprint 3: Exportação DXF (Sessão 143) ───
    case "generate_dxf_project": return executeGenerateDxfProject(ctx, args);
    // ─── Bloco H Sprint 4: MapBiomas (Sessão 144) ───
    case "fetch_mapbiomas_land_use": return executeFetchMapBiomasLandUse(ctx, args);
    case "fetch_mapbiomas_time_series": return executeFetchMapBiomasTimeSeries(ctx, args);
    // ─── Bloco H Sprint 5: Memorial Descritivo (Sessão 145) ───
    case "generate_memorial_descritivo": return executeGenerateMemorialDescritivo(ctx, args);
    case "list_memorial_descritivos": return executeListMemorialDescritivos(ctx, args);
    // ─── Bloco H Sprint 5: Zoneamento Municipal (Sessão 145) ───
    case "analyze_zoneamento_pdf": return executeAnalyzeZoneamentoPdf(ctx, args);
    case "get_zoneamento": return executeGetZoneamento(ctx, args);
    // ─── Bloco H Sprint 5: CRI Matrícula (Sessão 145) ───
    case "register_cri_matricula": return executeRegisterCriMatricula(ctx, args);
    case "list_cri_matriculas": return executeListCriMatriculas(ctx, args);
    // ─── Bloco H Sprint 5: FII/CRA Simulator (Sessão 145) ───
    case "simulate_fii": return executeSimulateFii(ctx, args);
    case "simulate_cri_cra": return executeSimulateCriCra(ctx, args);
    default: return { error: `Tool desconhecida: ${toolName}` };
  }
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Get tenant_id + name from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, name")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = profile?.tenant_id || user.id;

    const userName = profile?.name || "Usuário";
    const { messages, pageContext } = await req.json();

    // API Key — OpenRouter
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    // Build context
    let contextSummary = "";
    try {
      if (pageContext) {
        if (pageContext.includes("Contratos") || pageContext.includes("contracts")) {
          const { data: contracts } = await supabase
            .from("contracts")
            .select("id, status, end_date, monthly_value")
            .eq("tenant_id", tenantId)
            .limit(50);
          const activeCount = contracts?.filter((c: Record<string, unknown>) => c.status === "ativo").length || 0;
          const expiring = contracts?.filter((c: Record<string, unknown>) => {
            if (!c.end_date) return false;
            const days = Math.ceil((new Date(String(c.end_date)).getTime() - Date.now()) / 86400000);
            return days <= 90 && days >= 0;
          });
          const totalMonthly = contracts?.filter((c: Record<string, unknown>) => c.status === "ativo")
            .reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.monthly_value) || 0), 0) || 0;
          contextSummary = `Contratos: ${contracts?.length || 0} total, ${activeCount} ativos. Vencendo em 90 dias: ${expiring?.length || 0}. Receita mensal ativa: R$ ${totalMonthly.toFixed(2)}.`;
        }

        if (pageContext.includes("Financeiro") || pageContext.includes("finance") || pageContext.includes("Inadimplência")) {
          const { data: installments } = await supabase
            .from("contract_installments")
            .select("id, status, amount, due_date")
            .eq("tenant_id", tenantId)
            .eq("status", "atrasado")
            .limit(20);
          const totalOverdue = installments?.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.amount) || 0), 0) || 0;
          contextSummary = `Parcelas atrasadas: ${installments?.length || 0}. Valor total inadimplente: R$ ${totalOverdue.toFixed(2)}.`;
        }

        if (pageContext.includes("Leads") || pageContext.includes("leads") || pageContext.includes("CRM")) {
          const { data: leads } = await supabase
            .from("leads")
            .select("id, status, score")
            .eq("tenant_id", tenantId)
            .limit(30);
          const hot = leads?.filter((l: Record<string, unknown>) => (Number(l.score) || 0) >= 70);
          contextSummary = `Leads: ${leads?.length || 0} total. Leads quentes (score ≥ 70): ${hot?.length || 0}.`;
        }

        if (pageContext.includes("HelpDesk") || pageContext.includes("Atendimento") || pageContext.includes("tickets")) {
          const { data: tickets } = await supabase
            .from("support_tickets")
            .select("id, status, priority, created_at")
            .eq("tenant_id", tenantId)
            .in("status", ["aberto", "em_atendimento"])
            .limit(20);
          contextSummary = `Tickets abertos/em atendimento: ${tickets?.length || 0}.`;
        }

        if (pageContext.includes("Dashboard") || pageContext === "Dashboard Principal") {
          const { data: contracts } = await supabase
            .from("contracts")
            .select("id, status, monthly_value")
            .eq("tenant_id", tenantId);
          const activeCount = contracts?.filter((c: Record<string, unknown>) => c.status === "ativo").length || 0;
          const totalMonthly = contracts?.filter((c: Record<string, unknown>) => c.status === "ativo")
            .reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.monthly_value) || 0), 0) || 0;

          const { data: overdue } = await supabase
            .from("contract_installments")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("status", "atrasado");

          contextSummary = `Visão geral: ${contracts?.length || 0} contratos (${activeCount} ativos). Receita mensal: R$ ${totalMonthly.toFixed(2)}. Parcelas atrasadas: ${overdue?.length || 0}.`;
        }

        if (pageContext.includes("Parcelamento") || pageContext.includes("parcelamento")) {
          const { data: projects } = await supabase
            .from("development_parcelamento")
            .select("id, name, status, total_units, vgv_estimado")
            .eq("tenant_id", tenantId)
            .limit(20);

          const totalProjects = projects?.length || 0;
          const totalUnits = projects?.reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.total_units) || 0), 0) || 0;
          const totalVGV = projects?.reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.vgv_estimado) || 0), 0) || 0;
          const byStatus: Record<string, number> = {};
          for (const p of projects ?? []) {
            const st = String((p as Record<string, unknown>).status || "desconhecido");
            byStatus[st] = (byStatus[st] || 0) + 1;
          }
          const statusStr = Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(", ");
          contextSummary = `Parcelamento de Solo: ${totalProjects} projeto(s) (${statusStr}). Total: ${totalUnits} lotes. VGV estimado: R$ ${(totalVGV / 1_000_000).toFixed(1)}M.`;

          // If on a specific project page, fetch active scenario KPIs
          const projectMatch = (pageContext.match(/Visão Geral|Análise Financeira|Conformidade|Análise do Terreno/) && projects && projects.length > 0);
          if (projectMatch) {
            // Try to get the most recent active scenario
            const { data: scenario } = await supabase
              .from("development_parcelamento_scenarios")
              .select("vpl, tir_anual, payback_meses, performance_score, vgv_total, is_calculated")
              .eq("tenant_id", tenantId)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (scenario && (scenario as Record<string, unknown>).is_calculated) {
              const sc = scenario as Record<string, unknown>;
              contextSummary += ` Cenário ativo: VPL R$ ${((Number(sc.vpl) || 0) / 1_000_000).toFixed(2)}M, TIR ${(Number(sc.tir_anual) || 0).toFixed(1)}%, Payback ${sc.payback_meses || "—"} meses, Score ${Math.round(Number(sc.performance_score) || 0)}/100.`;
            }
          }
        }
      }
    } catch {
      // Context fetch failed, proceed without it
    }

    const systemPrompt = `Você é o Analista Intentus, um assistente IA especialista em gestão imobiliária integrado à plataforma Intentus Real Estate. Você está ajudando ${userName}.

Contexto da tela atual: ${pageContext || "Dashboard principal"}
${contextSummary ? `\nDados em tempo real:\n${contextSummary}` : ""}

## Capacidades (Agentic Mode)
Você tem acesso a ferramentas para AGIR na plataforma, não apenas responder perguntas:

**Criação Conversacional de Contratos (NOVO!):**
- Guiar o usuário passo a passo para criar um contrato por conversa
- Buscar imóveis e pessoas cadastradas por nome
- Criar contrato diretamente no banco (create_contract)
- OU preparar dados para o formulário visual (prefill_contract_form)
- O usuário escolhe: criar direto pelo chat ou abrir formulário pré-preenchido

**Contratos:**
- Buscar contratos por status, tipo, vencimento
- Ver detalhes completos de um contrato (partes, parcelas, obrigações)
- Alterar status de contratos (transições de estado)
- Obter resumo do portfólio

**Parcelamento de Solo (Loteamentos Horizontais):**
- Listar todos os projetos de parcelamento com status, VGV e número de lotes
- Consultar KPIs financeiros: VPL, TIR, payback, margem líquida, performance score
- Comparar cenários financeiros lado a lado com delta (compare_parcelamento_scenarios)
- Consultar premissas profundas de um cenário (projeto, vendas, terreno, custos de infraestrutura)
- Verificar status de conformidade legal (Lei 6.766, Lei 4.591, score de compliance)
- Sugerir até 3 melhorias concretas para aumentar o Performance Score
- **EXECUTAR AÇÕES**: alterar premissas (update_parcelamento_premises) e rodar simulação (simulate_parcelamento) — com confirmação do usuário
- **ANÁLISE PREDITIVA**: estimar viabilidade de terrenos com apenas localização e área (predict_viability)
- **DETECTOR DE RISCOS**: análise de red flags financeiros, legais e operacionais (detect_red_flags)

**Obrigações:**
- Listar obrigações vencidas ou próximas de vencer
- Acompanhar prazos e tipos de obrigações

**Notificações:**
- Listar notificações não-lidas
- Criar lembretes e alertas personalizados

## Fluxo de Criação Conversacional de Contrato
Quando o usuário pedir para criar um contrato, siga este fluxo:

1. **Pergunte o tipo**: locação, venda, administração ou distrato
2. **Pergunte sobre o imóvel**: Use search_properties para buscar por nome/endereço. Apresente opções se houver múltiplos resultados.
3. **Pergunte sobre as partes**: Quem é o locatário/comprador? E o proprietário/locador? Use search_people para encontrá-los.
4. **Colete dados financeiros**:
   - Locação: valor mensal, índice de reajuste (IGP-M, IPCA), tipo de garantia, dia do vencimento
   - Venda: valor total, condições de pagamento
5. **Colete datas**: início e término do contrato
6. **Apresente resumo** com todos os dados coletados em formato claro
7. **Ofereça 2 opções**:
   - "✅ **Criar agora** — Salvo diretamente como rascunho"
   - "📝 **Abrir no formulário** — Preencho o formulário para você revisar e editar"
8. **Execute** a opção escolhida (create_contract ou prefill_contract_form)

**IMPORTANTE sobre prefill_contract_form:** Quando usar esta tool, SEMPRE inclua na sua resposta final ao usuário o bloco especial:
\`\`\`
<!--COPILOT_ACTION:PREFILL_CONTRACT-->
\`\`\`
Isso permite ao frontend detectar e abrir o formulário automaticamente. Inclua APÓS sua mensagem de texto.

Pergunte um item de cada vez para não sobrecarregar o usuário. Seja amigável e sugira valores padrão quando fizer sentido (ex: "Índice de reajuste: IGP-M é o mais comum, deseja usar?").

## Diretrizes
- Responda SEMPRE em português do Brasil
- Use as ferramentas proativamente quando a pergunta do usuário se beneficiar de dados reais
- Para AÇÕES que modificam dados (transição de status, criação), explique o que vai fazer e peça confirmação antes de executar
- Para CONSULTAS (buscar, listar), execute diretamente sem pedir confirmação
- Seja direto, preciso e use dados reais quando disponíveis
- Sugira ações específicas e acionáveis
- Use emojis com moderação para melhorar a leitura
- Formate com markdown quando ajudar a clareza
- Se não tiver dados suficientes, diga claramente
- Foque em insights que geram valor para o negócio imobiliário

## Parcelamento de Solo — Diretrizes Específicas
Quando o usuário estiver na tela de Parcelamento ou perguntar sobre projetos de loteamento:
- Use list_parcelamento_projects para mostrar um panorama dos projetos
- Use get_parcelamento_financial para analisar KPIs e identificar pontos de atenção
- Compare cenários com get_parcelamento_scenarios — destaque qual tem melhor VPL/TIR
- Se o compliance score for < 80, alerte sobre pendências legais e use get_parcelamento_compliance
- Interprete os indicadores financeiros: VPL positivo = viável, TIR > 15% = atrativo, Payback < 48 meses = aceitável, Score ≥ 50/100 = adequado
- Sugira ações concretas: "ajustar preço médio", "reduzir prazo de vendas", "revisar custos de infraestrutura"

## Execute Actions (NOVO — v17)
Você agora pode ALTERAR dados e executar ações no módulo de Parcelamento:

**update_parcelamento_premises**: Atualiza premissas de um cenário (preço, lotes, custos, prazos).
- SEMPRE peça confirmação ANTES de alterar: "Vou alterar o preço médio de R$ 200k para R$ 250k. Confirma?"
- Mostre ANTES × DEPOIS claramente
- Após alterar, ofereça rodar a simulação para ver o impacto

**simulate_parcelamento**: Roda a simulação financeira completa.
- Retorna comparação ANTES × DEPOIS dos KPIs
- Destaque as melhorias (🟢) e pioras (🔴) no delta
- Formate a tabela de comparação em markdown

**Fluxo típico de Execute Action:**
1. Usuário: "Mude o preço médio para R$ 250.000"
2. Você: Busca cenário ativo → mostra valor atual → pede confirmação
3. Usuário: "Sim"
4. Você: Executa update_parcelamento_premises → mostra o que mudou
5. Você: "Deseja que eu rode a simulação para ver o impacto nos KPIs?"
6. Usuário: "Sim"
7. Você: Executa simulate_parcelamento → mostra tabela ANTES × DEPOIS com deltas

## Análise Preditiva (predict_viability)
- Use quando o usuário perguntar "esse terreno é viável?" ou "quanto vale investir em X?"
- Não precisa de cenário salvo — funciona com localização + área + estimativas
- SEMPRE deixe claro que é uma estimativa baseada em benchmarks regionais
- Recomende cadastrar o projeto para análise precisa

## Comparador de Cenários (compare_parcelamento_scenarios)
- Use quando o usuário perguntar "qual cenário é melhor?" ou "compare os cenários"
- Formate a comparação como tabela markdown com destaque no melhor de cada métrica
- Sempre inclua a recomendação final com justificativa

## Detector de Red Flags (detect_red_flags)
- Use proativamente se detectar indicadores preocupantes ao analisar um projeto
- Ou quando o usuário perguntar "quais os riscos?" ou "tem algum problema?"
- Priorize flags CRÍTICOS e ALTOS na resposta
- Para cada flag, apresente: problema + explicação + ação recomendada

## Regulações Brasil (Bloco H — NOVO v18)
Você agora tem 4 ferramentas de regulação brasileira:
- **calc_itbi**: Calcula ITBI municipal sobre terreno e vendas. Use quando discutir custos tributários.
- **calc_outorga**: Calcula Outorga Onerosa (OODC). Loteamentos abertos geralmente são isentos.
- **check_lei_verde**: Checklist ambiental (permeabilidade, área verde, RL, arborização, compensação).
- **validate_cnpj_spe**: Valida CNPJ de incorporador/SPE na Receita Federal. Verifica situação, CNAE, natureza jurídica.

Quando o usuário perguntar sobre impostos, tributação, ITBI, outorga, meio ambiente, arborização, CNPJ ou SPE, use a ferramenta correspondente.

### Benchmarks de Mercado (Bloco H Sprint 2)
- **fetch_sinapi**: Consulta custos SINAPI (Caixa) por UF. Terraplanagem, pavimentação, drenagem, água, esgoto, elétrica, guias, calçadas, paisagismo, contenções.
- **fetch_secovi**: Preço/m², IVV, meses de estoque por cidade. Cobre 20+ cidades, lotes e casas.
- **fetch_abrainc**: Lançamentos, VSO, distrato, margem bruta por região e segmento (MCMV, MAP, loteamento).

Quando o usuário perguntar sobre custos de construção, preço de referência, comparação de mercado, velocidade de vendas, benchmarks, SINAPI, SECOVI ou ABRAINC, use a ferramenta correspondente.

### Censo IBGE (Bloco H Sprint 3)
- **fetch_census_income**: Renda domiciliar e per capita por setor censitário. Classe predominante (A/B/C/D/E), % acima de 5 SM e abaixo de 1 SM.
- **fetch_census_demographics**: População, densidade, crescimento anual, urbanização, idade média, índice de envelhecimento.
- **fetch_census_housing**: Total domicílios, posse (próprio/alugado), infraestrutura (esgoto/água/lixo), déficit habitacional.

Quando o usuário perguntar sobre renda da região, população, demografia, perfil de renda, classe social, demanda habitacional ou déficit habitacional, use as ferramentas do Censo IBGE.

### Embargos Ambientais (Bloco H Sprint 3)
- **check_ibama_embargoes**: Verifica embargos IBAMA vigentes por coordenadas ou município. Classifica risco: baixo/moderado/alto/crítico. CRÍTICO para due diligence.
- **check_icmbio_ucs**: Verifica sobreposição com UCs (Proteção Integral = bloqueante, Uso Sustentável = restritivo). Detecta zona de amortecimento.

SEMPRE use check_ibama_embargoes proativamente ao analisar um terreno novo. Embargo vigente é show-stopper.

### Exportação DXF (Bloco H Sprint 3)
- **generate_dxf_project**: Gera pré-projeto urbanístico em DXF (AutoCAD R12). Layers: perímetro, lotes, vias, APP, áreas verdes/institucionais, carimbo. Retorna resumo do layout.

Quando o usuário pedir para gerar DXF, exportar para AutoCAD, preparar projeto para prefeitura ou criar planta do loteamento, use generate_dxf_project.

## Formato de Ações
Quando executar uma ação que modifica dados, siga este padrão:
1. Explique o que pretende fazer
2. Peça confirmação ao usuário ("Deseja que eu prossiga?")
3. Só execute após confirmação

Para consultas de leitura, execute diretamente e apresente os resultados de forma clara.`;

    const toolCtx: ToolContext = { supabase, userId: user.id, tenantId, userName };

    // ──────────────────────────────────────────────
    // Agentic Loop: model → tool calls → results → model
    // ──────────────────────────────────────────────

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const MAX_TOOL_ROUNDS = 5;
    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const isLastRound = round === MAX_TOOL_ROUNDS;

      const openRouterBody: Record<string, unknown> = {
        model: "google/gemini-2.0-flash-001",
        messages: chatMessages,
        stream: isLastRound, // Stream only the final response
      };

      // Add tools only if not last round (force text response on last round)
      if (!isLastRound) {
        openRouterBody.tools = TOOLS;
        openRouterBody.tool_choice = "auto";
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://intentus-plataform.vercel.app",
          "X-Title": "Intentus Copilot",
        },
        body: JSON.stringify(openRouterBody),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("OpenRouter error:", response.status, t);
        return new Response(JSON.stringify({ error: "Erro ao conectar com a IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If streaming (last round), pass through directly
      if (isLastRound) {
        return new Response(response.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Non-streaming: parse response to check for tool calls
      const result = await response.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assistantMessage = choice.message;

      // If no tool calls, stream the text content as SSE
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        // Convert text response to SSE format for frontend compatibility
        const textContent = assistantMessage.content || "";
        const ssePayload = `data: ${JSON.stringify({
          choices: [{ delta: { content: textContent } }],
        })}\n\ndata: [DONE]\n\n`;

        return new Response(ssePayload, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Has tool calls — execute them and continue the loop
      chatMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          fnArgs = {};
        }

        console.log(`[Copilot] Tool call: ${fnName}`, JSON.stringify(fnArgs).slice(0, 200));

        let toolResult: unknown;
        try {
          toolResult = await executeTool(toolCtx, fnName, fnArgs);
        } catch (err) {
          console.error(`[Copilot] Tool error (${fnName}):`, err);
          toolResult = { error: `Erro ao executar ${fnName}: ${err instanceof Error ? err.message : "erro desconhecido"}` };
        }

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Loop continues — model will process tool results
    }

    // Should not reach here, but safety net
    const fallbackSSE = `data: ${JSON.stringify({
      choices: [{ delta: { content: "Desculpe, houve um erro no processamento. Tente novamente." } }],
    })}\n\ndata: [DONE]\n\n`;

    return new Response(fallbackSSE, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("copilot error:", e);
    const corsHeaders = buildCorsHeaders(req);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
