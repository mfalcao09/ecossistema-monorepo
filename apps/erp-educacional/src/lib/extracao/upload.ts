/**
 * Sprint 2 / Etapa 2 — Helper de upload client-side para o bucket `processo-arquivos`.
 *
 * Estratégia: o navegador faz upload direto para o Supabase Storage usando a
 * sessão autenticada do usuário (anon key + JWT). Isso evita o limite de 4.5 MB
 * do Vercel serverless e é mais rápido — o byte stream nunca passa pelo Next.js.
 *
 * Path pattern: `{tenantId}/{userId}/{timestamp}-{nome-sanitizado}`
 *   - Primeiro segmento é o tenant (IES dona) — casado com a policy RLS
 *     processo_arquivos_tenant_* que valida membership via usuario_papeis.
 *     Isso permite que qualquer usuário com papel ativo no tenant veja os
 *     arquivos da sessão (ver PR #89 — acesso compartilhado dentro do tenant).
 *   - Segundo segmento é o userId do uploader (auditoria de quem subiu).
 *   - timestamp evita colisão de nomes.
 *   - sanitização remove acentos e caracteres especiais.
 */

import { createClient } from "@/lib/supabase/client";

export const PROCESSO_ARQUIVOS_BUCKET = "processo-arquivos";

/** 25 MB — bate com o file_size_limit do bucket */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** MIME types aceitos pelo bucket */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Quantos uploads simultâneos no máximo (evita saturar conexão) */
const MAX_CONCURRENCY = 3;

/**
 * Metadados do arquivo após upload, no formato esperado por
 * POST /api/extracao/iniciar.
 */
export interface ArquivoUploadado {
  storage_path: string;
  bucket: string;
  nome_original: string;
  mime_type: string;
  tamanho_bytes: number;
}

export interface UploadProgressEvento {
  arquivoIndex: number;
  nomeOriginal: string;
  status: "pendente" | "enviando" | "concluido" | "erro";
  erro?: string;
}

export type UploadProgressCallback = (evento: UploadProgressEvento) => void;

/**
 * Sanitiza um nome de arquivo:
 *   - Remove acentos (NFD + diacritics)
 *   - Substitui caracteres não alfanuméricos por hífen
 *   - Comprime hífens consecutivos
 *   - Limita a 100 caracteres (margem pra timestamp e extensão)
 */
export function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/**
 * Constrói o storage path completo para um arquivo:
 *   {tenantId}/{userId}/{timestamp}-{nome-sanitizado}
 */
export function montarStoragePath(
  tenantId: string,
  userId: string,
  file: File,
): string {
  const timestamp = Date.now();
  const nomeSeguro = sanitizarNomeArquivo(file.name);
  return `${tenantId}/${userId}/${timestamp}-${nomeSeguro}`;
}

/**
 * Resolve o tenant_id da membership ativa do usuário em `usuario_papeis`.
 * Se o usuário tiver múltiplas memberships ativas (multi-tenant), retorna a
 * primeira encontrada — o piloto FIC tem exatamente um tenant por usuário no
 * módulo Diploma. Multi-tenant selector fica como follow-up quando existir
 * um segundo tenant emissor.
 */
async function resolverTenantAtivo(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("usuario_papeis")
    .select("tenant_id, data_fim")
    .eq("user_id", userId)
    .or(
      "data_fim.is.null,data_fim.gte." + new Date().toISOString().slice(0, 10),
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível identificar sua instituição (${error.message}).`,
    );
  }
  if (!data?.tenant_id) {
    throw new Error(
      "Sua conta não tem papel ativo em nenhuma instituição. " +
        "Peça ao administrador para atribuir um papel.",
    );
  }
  return data.tenant_id;
}

/**
 * Valida um arquivo antes do upload. Retorna null se OK, ou string com motivo
 * da rejeição (pra exibir em toast).
 */
export function validarArquivoLocal(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `Arquivo muito grande (${mb} MB). Máximo: 25 MB.`;
  }
  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return `Tipo de arquivo não aceito (${file.type || "desconhecido"}). Use PDF ou imagem.`;
  }
  return null;
}

/**
 * Faz upload de uma lista de arquivos pro bucket `processo-arquivos`,
 * com paralelismo controlado e callback de progresso.
 *
 * Lança erro se o usuário não estiver autenticado. Retorna a lista
 * de arquivos uploadados na MESMA ORDEM da entrada (importante: o backend
 * usa o índice pra correlacionar com a `dados_extraidos`).
 */
export async function uploadArquivosParaProcesso(
  files: File[],
  onProgress?: UploadProgressCallback,
): Promise<ArquivoUploadado[]> {
  if (files.length === 0) {
    throw new Error("Nenhum arquivo fornecido para upload.");
  }

  const supabase = createClient();

  // Pega o userId da sessão atual (necessário pro path do RLS)
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const userId = user.id;

  // Resolve o tenant ativo do usuário — primeiro segmento do path no bucket.
  // Falha cedo se o usuário não tiver papel ativo em nenhum tenant (situação
  // que quebraria o upload pela policy RLS processo_arquivos_tenant_insert).
  const tenantId = await resolverTenantAtivo(supabase, userId);

  // Valida todos antes de subir qualquer um (fail fast)
  files.forEach((file, idx) => {
    const erro = validarArquivoLocal(file);
    if (erro) {
      throw new Error(`Arquivo "${file.name}": ${erro}`);
    }
    onProgress?.({
      arquivoIndex: idx,
      nomeOriginal: file.name,
      status: "pendente",
    });
  });

  // Upload com paralelismo limitado: processa em chunks de MAX_CONCURRENCY.
  // Tracks de paths já uploadados pra cleanup em caso de falha (review Buchecha).
  const resultado: ArquivoUploadado[] = new Array(files.length);
  const pathsUploadados: string[] = [];

  try {
    for (let i = 0; i < files.length; i += MAX_CONCURRENCY) {
      const chunk = files.slice(i, i + MAX_CONCURRENCY);
      const indices = chunk.map((_, j) => i + j);

      await Promise.all(
        chunk.map(async (file, chunkIdx) => {
          const arquivoIndex = indices[chunkIdx];
          const storagePath = montarStoragePath(tenantId, userId, file);

          onProgress?.({
            arquivoIndex,
            nomeOriginal: file.name,
            status: "enviando",
          });

          const { error: upErr } = await supabase.storage
            .from(PROCESSO_ARQUIVOS_BUCKET)
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type,
            });

          if (upErr) {
            onProgress?.({
              arquivoIndex,
              nomeOriginal: file.name,
              status: "erro",
              erro: upErr.message,
            });
            throw new Error(`Falha ao enviar "${file.name}": ${upErr.message}`);
          }

          // Sucesso — registra pra eventual cleanup e popula resultado
          pathsUploadados.push(storagePath);
          resultado[arquivoIndex] = {
            storage_path: storagePath,
            bucket: PROCESSO_ARQUIVOS_BUCKET,
            nome_original: file.name,
            mime_type: file.type,
            tamanho_bytes: file.size,
          };

          onProgress?.({
            arquivoIndex,
            nomeOriginal: file.name,
            status: "concluido",
          });
        }),
      );
    }

    return resultado;
  } catch (err) {
    // Cleanup best-effort: remove os arquivos que já tinham subido pra evitar
    // órfãos no bucket. Se a remoção falhar, ignoramos silenciosamente —
    // o cron de limpeza (futuro) ainda pega.
    if (pathsUploadados.length > 0) {
      try {
        await supabase.storage
          .from(PROCESSO_ARQUIVOS_BUCKET)
          .remove(pathsUploadados);
      } catch {
        // Não vaza o erro de cleanup; o erro original é mais relevante.
      }
    }
    throw err;
  }
}
