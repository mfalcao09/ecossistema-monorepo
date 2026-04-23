/**
 * Cliente HTTP para rotas de voz do orchestrator (apps/orchestrator).
 *
 *   POST /voice/transcribe   — multipart file → {text, language, duration}
 *   POST /voice/synthesize   — {text} → streaming audio/mpeg
 *   GET  /voice/health       — {stt_available, tts_available}
 *
 * F1-S03 PR 3/4.
 */

export interface VoiceConfig {
  baseUrl: string;
  token: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number | null;
}

export interface VoiceHealth {
  stt_available: boolean;
  tts_available: boolean;
  stt_model: string;
  tts_model: string;
}

/** Status do endpoint — útil pro app desabilitar mic quando STT off. */
export async function fetchVoiceHealth(
  config: VoiceConfig,
): Promise<VoiceHealth> {
  const r = await fetch(`${config.baseUrl}/voice/health`);
  if (!r.ok) {
    throw new Error(`voice/health ${r.status}`);
  }
  return (await r.json()) as VoiceHealth;
}

/**
 * Envia arquivo gravado pelo expo-audio e devolve a transcrição.
 *
 * `audioUri` no iOS é um caminho `file://...m4a`. React Native aceita
 * passar o objeto `{ uri, name, type }` direto no FormData — isso é
 * especificidade do RN que o TS do DOM não tipa. Cast para any.
 */
export async function transcribeAudio(
  config: VoiceConfig,
  audioUri: string,
  opts: { filename?: string; mimeType?: string; language?: string } = {},
): Promise<TranscriptionResult> {
  const filename = opts.filename ?? "audio.m4a";
  const mimeType = opts.mimeType ?? "audio/m4a";
  const language = opts.language ?? "pt";

  const form = new FormData();
  form.append("file", {
    uri: audioUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
  form.append("language", language);

  const r = await fetch(`${config.baseUrl}/voice/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      // Não setar Content-Type — fetch RN seta multipart/form-data com boundary
    },
    body: form,
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`transcribe ${r.status}: ${text || r.statusText}`);
  }

  return (await r.json()) as TranscriptionResult;
}

/**
 * Sintetiza `text` via ElevenLabs e retorna o áudio completo como blob.
 *
 * Escolha deliberada: consumimos o stream todo antes de devolver, porque
 * `expo-audio` precisa de um arquivo local (ou `data:` URI) para tocar.
 * Streaming de chunks direto no speaker exigiria player customizado.
 *
 * Retorna `string` data URI `data:audio/mpeg;base64,...` pronto pra
 * passar em `createAudioPlayer({ uri })`.
 */
export async function synthesizeSpeech(
  config: VoiceConfig,
  text: string,
): Promise<string> {
  const r = await fetch(`${config.baseUrl}/voice/synthesize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`synthesize ${r.status}: ${t || r.statusText}`);
  }

  const buf = await r.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  return `data:audio/mpeg;base64,${base64}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Encoda em chunks para não estourar call stack em áudios grandes.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  // btoa existe em RN moderno (Hermes) e web. Se um dia faltar, trocar
  // por uma lib como `base64-arraybuffer`.
  return globalThis.btoa(binary);
}
