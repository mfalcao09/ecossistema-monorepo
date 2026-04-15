// parse-contract-ai v7 — Edge Function de importação de contratos com IA
// Deploy: via Supabase MCP (não pelo repo)
// verify_jwt: false
//
// Changelog:
//   v5: Versão inicial com function calling (Gemini/OpenRouter)
//   v6: Melhorias no error handling — mensagens detalhadas de erro,
//       validação de texto mínimo, logging de API provider, detecção
//       de content filter (SAFETY/BLOCKED), detecção de text response
//       vs function call, mensagens específicas para 429/402/401/403
//   v7: Fix schema validation error 400 do OpenRouter/Google:
//       - Removido `nullable: true` do inspection_data (incompatível com formato OpenAI)
//       - Removido tratamento de `nullable` no convertSchema (resolve-persona.ts)
//       - `nullable` é específico da API Gemini e causava rejeição quando
//         o schema era convertido para formato OpenAI via OpenRouter
//
// NOTA: Este arquivo é uma cópia de referência do código deployado.
// O deploy real é feito via Supabase MCP (deploy_edge_function).
// Para a versão completa, consulte: supabase > Edge Functions > parse-contract-ai

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Código completo disponível via Supabase Dashboard ou MCP get_edge_function
// Este stub documenta a interface e o fluxo principal.
//
// Fluxo:
// 1. Recebe { contract_text: string, addenda_texts?: string[] }
// 2. Resolve persona via ai_prompts table (function_key: "contract_parser")
// 3. Chama Gemini/OpenRouter com function calling (extract_contract_data)
// 4. Extrai: contractData, parties, propertyData, propertiesData, peopleData, inspectionData
//
// Response (sucesso):
// {
//   contractData: { contract_type, status, start_date, end_date, monthly_value, ... },
//   parties: [{ name, role, cpf_cnpj }],
//   clausesSummary: "...",
//   propertyData: { title, property_type, street, ... },
//   propertiesData: [{ ... }],
//   peopleData: [{ name, contractRole, cpf_cnpj, entity_type, email, phone, ... }],
//   inspectionData: { conducted_date, items: [{ room_name, item_name, condition }] } | null
// }
//
// Response (erro):
// { error: "Mensagem detalhada do erro", status?: number }

export const PARSE_CONTRACT_AI_VERSION = 7;
