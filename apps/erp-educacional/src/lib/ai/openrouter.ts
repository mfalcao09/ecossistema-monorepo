/**
 * Utilitário para chamadas à API OpenRouter
 * Lê a chave e modelo das configurações do sistema (system_settings + ia_configuracoes)
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content:
    | string
    | Array<{
        type: "text" | "image_url";
        text?: string;
        image_url?: { url: string };
      }>;
}

interface OpenRouterOptions {
  modelo?: string;          // Modelo específico (sobrepõe o do painel)
  modulo?: string;          // Módulo para buscar agente configurado (ex: "cadastro")
  funcionalidade?: string;  // Funcionalidade específica (ex: "extracao_cursos") — prioridade sobre só módulo
  nomeAgente?: string;      // Nome do agente específico (ex: "agente-cursos")
  maxTokens?: number;
  temperatura?: number;
  systemPrompt?: string;
}

/**
 * Busca a chave OpenRouter e modelo configurado para um módulo/agente/funcionalidade
 * Ordem de prioridade: modulo+funcionalidade > nomeAgente > só modulo > global
 */
export async function getIAConfig(modulo?: string, nomeAgente?: string, funcionalidade?: string): Promise<{
  apiKey: string;
  modelo: string;
  temperatura: number;
  persona?: string;
}> {
  const admin = getAdminClient();

  // Busca chave do sistema
  const { data: sysData } = await admin
    .from("system_settings")
    .select("openrouter_api_key")
    .eq("id", 1)
    .single();

  const apiKey = sysData?.openrouter_api_key ?? process.env.OPENROUTER_API_KEY ?? "";

  // 1. Prioridade máxima: busca por módulo + funcionalidade específica
  if (modulo && funcionalidade) {
    const funcResult = await admin
      .from("ia_configuracoes")
      .select("*")
      .eq("ativo", true)
      .eq("modulo", modulo)
      .eq("funcionalidade", funcionalidade)
      .limit(1)
      .single();

    if (funcResult.data) {
      return {
        apiKey,
        modelo: funcResult.data.modelo ?? "anthropic/claude-haiku-4-5",
        temperatura: funcResult.data.temperatura ?? 0.3,
        persona: funcResult.data.persona,
      };
    }
  }

  // 2. Busca por nome específico do agente
  if (nomeAgente) {
    const nomeResult = await admin
      .from("ia_configuracoes")
      .select("*")
      .eq("ativo", true)
      .eq("nome_agente", nomeAgente)
      .limit(1)
      .single();

    if (nomeResult.data) {
      return {
        apiKey,
        modelo: nomeResult.data.modelo ?? "anthropic/claude-haiku-4-5",
        temperatura: nomeResult.data.temperatura ?? 0.3,
        persona: nomeResult.data.persona,
      };
    }
  }

  // 3. Busca por módulo (sem funcionalidade) — agente padrão do módulo
  if (modulo) {
    const moduloResult = await admin
      .from("ia_configuracoes")
      .select("*")
      .eq("ativo", true)
      .eq("modulo", modulo)
      .is("funcionalidade", null)
      .limit(1)
      .single();

    if (moduloResult.data) {
      return {
        apiKey,
        modelo: moduloResult.data.modelo ?? "anthropic/claude-haiku-4-5",
        temperatura: moduloResult.data.temperatura ?? 0.3,
        persona: moduloResult.data.persona,
      };
    }

    // 3b. Se não houver agente padrão sem funcionalidade, pega qualquer agente do módulo
    const moduloAnyResult = await admin
      .from("ia_configuracoes")
      .select("*")
      .eq("ativo", true)
      .eq("modulo", modulo)
      .limit(1)
      .single();

    if (moduloAnyResult.data) {
      return {
        apiKey,
        modelo: moduloAnyResult.data.modelo ?? "anthropic/claude-haiku-4-5",
        temperatura: moduloAnyResult.data.temperatura ?? 0.3,
        persona: moduloAnyResult.data.persona,
      };
    }
  }

  // Fallback para agente global
  const globalResult = await admin
    .from("ia_configuracoes")
    .select("*")
    .eq("modulo", "global")
    .eq("ativo", true)
    .limit(1)
    .single();
  const globalAgent = globalResult.data;

  return {
    apiKey,
    modelo: globalAgent?.modelo ?? "anthropic/claude-haiku-4-5",
    temperatura: globalAgent?.temperatura ?? 0.3,
    persona: globalAgent?.persona,
  };
}

/**
 * Realiza uma chamada à API OpenRouter
 * Retorna o texto da resposta ou lança erro
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const {
    modelo: modeloOverride,
    modulo,
    funcionalidade,
    nomeAgente,
    maxTokens = 4096,
    temperatura: tempOverride,
    systemPrompt,
  } = options;

  const config = await getIAConfig(modulo, nomeAgente, funcionalidade);

  if (!config.apiKey) {
    throw new Error(
      "API OpenRouter não configurada. Acesse Configurações → IA para adicionar sua chave."
    );
  }

  const modelo = modeloOverride ?? config.modelo;
  const temperatura = tempOverride ?? config.temperatura;

  // Prepara mensagens com system prompt opcional
  const finalMessages: OpenRouterMessage[] = [];

  const systemContent = [
    systemPrompt,
    config.persona,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (systemContent) {
    finalMessages.push({ role: "system", content: systemContent });
  }

  finalMessages.push(...messages);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://diploma-digital.vercel.app",
      "X-Title": "FIC Diploma Digital",
    },
    body: JSON.stringify({
      model: modelo,
      messages: finalMessages,
      max_tokens: maxTokens,
      temperature: temperatura,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errMsg = `OpenRouter API error: ${response.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson?.error?.message ?? errMsg;
    } catch {
      /* ignora */
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) throw new Error("OpenRouter retornou resposta vazia");
  return content;
}

/**
 * Versão simples para prompts de texto (sem array de mensagens)
 */
export async function callOpenRouterText(
  prompt: string,
  options: OpenRouterOptions = {}
): Promise<string> {
  return callOpenRouter([{ role: "user", content: prompt }], options);
}

/**
 * Versão para imagens (base64)
 */
export async function callOpenRouterImage(
  imageBase64: string,
  mediaType: string,
  textPrompt: string,
  options: OpenRouterOptions = {}
): Promise<string> {
  // Não força modelo padrão — deixa o agente configurado (via modulo+funcionalidade) decidir
  // Apenas usa claude-haiku como fallback final se nenhum modelo foi especificado via opções
  return callOpenRouter(
    [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${imageBase64}` },
          },
          { type: "text", text: textPrompt },
        ],
      },
    ],
    options
  );
}
