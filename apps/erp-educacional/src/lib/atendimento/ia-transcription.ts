/**
 * Transcrição de áudio via Gemini 2.5 Flash.
 *
 * Server-only. Usado pelo webhook Meta quando o app "ia_transcription"
 * estiver habilitado em app_installations.
 *
 * Fluxo:
 *   1. Meta envia payload com audio.media_id
 *   2. Fetch do binário via Graph API (/{media_id})
 *   3. Upload base64 para Gemini files API (inline parts)
 *   4. Gemini retorna transcrição em texto
 *   5. Update atendimento_messages.metadata.transcription
 *
 * ENV:
 *   GEMINI_API_KEY — sem isso função retorna null e loga aviso
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GRAPH_BASE = "https://graph.facebook.com/v19.0";

// Allowlist: hosts Meta/Facebook CDN de onde buscamos mídias. Defesa anti-SSRF:
// o Graph API autenticado retorna `meta.url` apontando para um destes — qualquer
// outro host significa payload manipulado e deve ser rejeitado.
const META_MEDIA_HOST_SUFFIXES = [
  "fbcdn.net",
  "facebook.com",
  "whatsapp.net",
  "cdninstagram.com",
];

function isValidMediaId(mediaId: string): boolean {
  // Meta media IDs são numéricos (~18 dígitos). Restringe strict para evitar SSRF.
  return /^[0-9]{1,40}$/.test(mediaId);
}

function isTrustedMetaMediaUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return META_MEDIA_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith("." + suffix),
    );
  } catch {
    return false;
  }
}

export async function isIaTranscriptionEnabled(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_installations")
    .select("enabled")
    .eq("app_key", "ia_transcription")
    .maybeSingle();
  return data?.enabled === true;
}

async function downloadMetaAudio(
  mediaId: string,
  accessToken: string,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  // Defesa SSRF: mediaId vem do webhook (já validado via HMAC em /webhook)
  // mas revalidamos aqui — qualquer char não-dígito significa payload corrompido.
  if (!isValidMediaId(mediaId)) {
    console.warn("[ia-transcription] invalid mediaId rejected");
    return null;
  }

  try {
    const metaRes = await fetch(
      `${GRAPH_BASE}/${encodeURIComponent(mediaId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    // Defesa SSRF: o CDN URL retornado pelo Graph deve ser de um host Meta conhecido.
    if (!isTrustedMetaMediaUrl(meta.url)) {
      console.warn("[ia-transcription] untrusted meta media url rejected");
      return null;
    }

    const audioRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!audioRes.ok) return null;
    return {
      bytes: await audioRes.arrayBuffer(),
      mime: meta.mime_type ?? "audio/ogg",
    };
  } catch (err) {
    console.warn("[ia-transcription] download failed", err);
    return null;
  }
}

function toBase64(bytes: ArrayBuffer): string {
  const buf = Buffer.from(bytes);
  return buf.toString("base64");
}

export async function transcribeAudio(params: {
  media_id?: string;
  access_token?: string;
  audio_url?: string;
  message_id: string;
}): Promise<{ ok: boolean; text?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "no_gemini_api_key" };
  }

  let inline: { bytes: ArrayBuffer; mime: string } | null = null;

  if (params.media_id && params.access_token) {
    inline = await downloadMetaAudio(params.media_id, params.access_token);
  } else if (params.audio_url) {
    // Defesa SSRF: só permite URL de Meta CDN (match de downloadMetaAudio).
    // Qualquer outro host = provável SSRF / payload manipulado.
    if (!isTrustedMetaMediaUrl(params.audio_url)) {
      return { ok: false, error: "untrusted_audio_url" };
    }
    try {
      const r = await fetch(params.audio_url);
      if (r.ok) {
        inline = {
          bytes: await r.arrayBuffer(),
          mime: r.headers.get("content-type") ?? "audio/ogg",
        };
      }
    } catch {
      inline = null;
    }
  }

  if (!inline) return { ok: false, error: "audio_fetch_failed" };

  const b64 = toBase64(inline.bytes);

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Transcreva integralmente este áudio em português brasileiro. Retorne apenas o texto transcrito, sem comentários adicionais.",
              },
              {
                inlineData: {
                  mimeType: inline.mime,
                  data: b64,
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    });

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        error: json.error?.message ?? `gemini_${res.status}`,
      };
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return { ok: false, error: "empty_transcription" };

    // Persiste em atendimento_messages.metadata.transcription
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("atendimento_messages")
      .select("metadata")
      .eq("id", params.message_id)
      .maybeSingle();

    const newMeta = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      transcription: text,
      transcription_at: new Date().toISOString(),
      transcription_provider: "gemini-2.5-flash",
    };

    await admin
      .from("atendimento_messages")
      .update({ metadata: newMeta })
      .eq("id", params.message_id);

    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "gemini_fetch_error",
    };
  }
}
