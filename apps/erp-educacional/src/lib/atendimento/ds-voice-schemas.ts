/**
 * Schemas Zod + tipos compartilhados DS Voice (isomórfico client/server).
 *
 * Sem imports de server: usar em componentes "use client" e em Route Handlers.
 */

import { z } from "zod";

export const DS_VOICE_ITEM_KINDS = [
  "messages",
  "audios",
  "media",
  "documents",
] as const;
export type DsVoiceItemKind = (typeof DS_VOICE_ITEM_KINDS)[number];

export const DS_VOICE_STEP_TYPES = [
  "message",
  "audio",
  "media",
  "document",
] as const;
export type DsVoiceStepType = (typeof DS_VOICE_STEP_TYPES)[number];

/** Converte plural (tabela-kind) → singular (step item_type). */
export function kindToStepType(kind: DsVoiceItemKind): DsVoiceStepType {
  return (
    {
      messages: "message",
      audios: "audio",
      media: "media",
      documents: "document",
    } as const
  )[kind];
}

export const messageCreateSchema = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  is_default: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;

export const audioCreateSchema = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  storage_path: z.string().min(1),
  file_url: z.string().url().optional().nullable(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  mime_type: z.string().optional(),
  send_as_voice_note: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type AudioCreateInput = z.infer<typeof audioCreateSchema>;

export const mediaCreateSchema = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  storage_path: z.string().min(1),
  file_url: z.string().url().optional().nullable(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  mime_type: z.string().optional(),
  media_type: z.enum(["image", "video"]).default("image"),
  caption: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});
export type MediaCreateInput = z.infer<typeof mediaCreateSchema>;

export const documentCreateSchema = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  storage_path: z.string().min(1),
  file_url: z.string().url().optional().nullable(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  mime_type: z.string().optional(),
  filename: z.string().max(260).optional(),
  enabled: z.boolean().optional(),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

// Funnels
export const funnelStepSchema = z.object({
  id: z.string().uuid().optional(),
  sort_order: z.number().int().nonnegative(),
  item_type: z.enum(DS_VOICE_STEP_TYPES),
  item_id: z.string().uuid(),
  delay_seconds: z.number().int().nonnegative(),
});
export type FunnelStepInput = z.infer<typeof funnelStepSchema>;

export const funnelUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  steps: z.array(funnelStepSchema).default([]),
});
export type FunnelUpsertInput = z.infer<typeof funnelUpsertSchema>;

// Triggers
export const triggerUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  trigger_type: z.enum(["keyword", "tag_added", "conversation_created"]),
  trigger_value: z.string().optional().nullable(),
  match_mode: z
    .enum(["contains", "equals", "starts_with", "regex"])
    .default("contains"),
  case_sensitive: z.boolean().default(false),
  funnel_id: z.string().uuid(),
  channels: z.array(z.string()).default(["whatsapp"]),
  enabled: z.boolean().default(true),
});
export type TriggerUpsertInput = z.infer<typeof triggerUpsertSchema>;

/**
 * Limites de upload (referência UI + guard server):
 *   - Áudio:    16 MB
 *   - Imagem:    5 MB
 *   - Vídeo:   100 MB
 *   - Documento: 100 MB
 */
export const UPLOAD_LIMITS = {
  audio: 16 * 1024 * 1024,
  image: 5 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 100 * 1024 * 1024,
} as const;

export const STORAGE_BUCKET = "atendimento";
