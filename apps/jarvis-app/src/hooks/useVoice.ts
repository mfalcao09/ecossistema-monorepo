/**
 * Hook de voz — gravação press-to-release + playback TTS.
 *
 * Usa expo-audio (SDK 52+) — substituiu o legacy expo-av.
 *
 * Fluxo:
 *   startRecording() → pede permissão + começa a gravar
 *   stopRecording()  → para, retorna URI local .m4a, chama transcribeAudio
 *                      → texto transcrito é injetado via onTranscribed callback
 *                      → consumidor chama useChat.send(text)
 *
 *   speak(text)      → TTS via synthesizeSpeech + playback via createAudioPlayer
 *
 * F1-S03 PR 3/4.
 */

import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchVoiceHealth,
  synthesizeSpeech,
  transcribeAudio,
  type VoiceConfig,
  type VoiceHealth,
} from "../services/voice";

export interface UseVoiceOptions {
  config: VoiceConfig;
  /** Chamado quando a transcrição chega — consumidor injeta no chat. */
  onTranscribed?: (text: string) => void;
  /** Chamado em qualquer erro (permissão, rede, provider). */
  onError?: (error: Error) => void;
}

export interface UseVoiceResult {
  /** Se o endpoint reporta STT/TTS ready. null até o health check responder. */
  health: VoiceHealth | null;

  recording: boolean;
  transcribing: boolean;
  speaking: boolean;

  /** Segurou o botão. */
  startRecording: () => Promise<void>;
  /** Soltou — dispara transcribe automaticamente. */
  stopRecording: () => Promise<void>;
  /** TTS + playback do texto. */
  speak: (text: string) => Promise<void>;
  /** Aborta playback em andamento. */
  stopSpeaking: () => void;
}

export function useVoice({
  config,
  onTranscribed,
  onError,
}: UseVoiceOptions): UseVoiceResult {
  const [health, setHealth] = useState<VoiceHealth | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const playerRef = useRef<AudioPlayer | null>(null);

  // ── Health check (best-effort, não bloqueia app) ───────────────────────
  useEffect(() => {
    if (!config.baseUrl) return;
    fetchVoiceHealth(config)
      .then(setHealth)
      .catch(() => {
        // Silencioso — app já mostra banner se config inteira falhar.
        setHealth({
          stt_available: false,
          tts_available: false,
          stt_model: "",
          tts_model: "",
        });
      });
  }, [config.baseUrl]);

  // ── Permissions + audio mode (uma vez no mount) ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          onError?.(new Error("Permissão do microfone negada."));
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (err) {
        onError?.(err as Error);
      }
    })();
    // onError é intencional fora das deps — queremos rodar UMA vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    if (recording) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (err) {
      onError?.(err as Error);
    }
  }, [recorder, recording, onError]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    setRecording(false);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error("Gravação sem URI — nada a transcrever.");
      }

      setTranscribing(true);
      const result = await transcribeAudio(config, uri, {
        filename: "jarvis-input.m4a",
        mimeType: "audio/m4a",
        language: "pt",
      });
      const text = result.text.trim();
      if (text) {
        onTranscribed?.(text);
      } else {
        onError?.(new Error("Não consegui transcrever — fala mais alto?"));
      }
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setTranscribing(false);
    }
  }, [recorder, recording, config, onTranscribed, onError]);

  const stopSpeaking = useCallback(() => {
    const p = playerRef.current;
    if (p) {
      try {
        p.pause();
        p.remove();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      // Aborta playback anterior se ainda estiver tocando.
      stopSpeaking();

      try {
        setSpeaking(true);
        const uri = await synthesizeSpeech(config, text.trim());
        const player = createAudioPlayer({ uri });
        playerRef.current = player;

        // expo-audio emite 'playbackStatusUpdate'.
        const sub = player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) {
            sub.remove();
            try {
              player.remove();
            } catch {
              // ignore
            }
            if (playerRef.current === player) {
              playerRef.current = null;
            }
            setSpeaking(false);
          }
        });

        player.play();
      } catch (err) {
        setSpeaking(false);
        onError?.(err as Error);
      }
    },
    [config, onError, stopSpeaking],
  );

  // Cleanup no unmount.
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    health,
    recording,
    transcribing,
    speaking,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
  };
}
