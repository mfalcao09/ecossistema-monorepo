/**
 * Rotas HTTP do gateway — v1.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { bearerAuth } from "./auth.js";
import { err, fromException, ok } from "./errors.js";
import type { InstanceManager } from "../instances/manager.js";
import {
  getInstance,
  listInstances,
} from "../db/instances.js";
import { listChats } from "../db/chats.js";
import { listMessagesForChat } from "../db/messages.js";
import { enqueueOutbound } from "../db/queue.js";

// --- schemas zod ---------------------------------------------------------

const CreateInstanceSchema = z.object({
  label: z.string().min(1).max(80),
  webhook_url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const SendMessageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    to: z.string().min(3),
    body: z.string().min(1).max(4096),
    reply_to_external_id: z.string().optional(),
  }),
  z.object({
    kind: z.enum(["image", "audio", "video", "document", "sticker"]),
    to: z.string().min(3),
    media: z.string().min(1),
    mimetype: z.string().optional(),
    filename: z.string().optional(),
    caption: z.string().max(1024).optional(),
  }),
  z.object({
    kind: z.literal("reaction"),
    to: z.string().min(3),
    target_external_id: z.string().min(1),
    emoji: z.string().max(10).nullable(),
  }),
]);

// --- factory -------------------------------------------------------------

export function createRoutes(manager: InstanceManager): Hono {
  const app = new Hono();

  app.use("/v1/*", bearerAuth);

  // POST /v1/instances
  app.post(
    "/v1/instances",
    zValidator("json", CreateInstanceSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const inst = await manager.createAndStart({
          label: body.label,
          metadata: {
            ...(body.metadata ?? {}),
            ...(body.webhook_url ? { webhook_url: body.webhook_url } : {}),
          },
        });
        return ok(c, inst, 201);
      } catch (e) {
        return fromException(c, e);
      }
    },
  );

  // GET /v1/instances
  app.get("/v1/instances", async (c) => {
    try {
      const status = c.req.query("status");
      const limit = c.req.query("limit");
      const list = await listInstances({
        status: status as any,
        limit: limit ? Number(limit) : undefined,
      });
      return ok(c, list);
    } catch (e) {
      return fromException(c, e);
    }
  });

  // GET /v1/instances/:id
  app.get("/v1/instances/:id", async (c) => {
    try {
      const inst = await getInstance(c.req.param("id"));
      if (!inst) return err(c, "NOT_FOUND", "instance not found", 404);
      return ok(c, inst);
    } catch (e) {
      return fromException(c, e);
    }
  });

  // GET /v1/instances/:id/qr
  app.get("/v1/instances/:id/qr", async (c) => {
    try {
      const inst = await getInstance(c.req.param("id"));
      if (!inst) return err(c, "NOT_FOUND", "instance not found", 404);
      return ok(c, {
        qr: inst.current_qr,
        expires_at: inst.current_qr_expires_at,
        status: inst.status,
      });
    } catch (e) {
      return fromException(c, e);
    }
  });

  // POST /v1/instances/:id/pairing-code  — alternativa ao QR (quando QR throttle)
  app.post(
    "/v1/instances/:id/pairing-code",
    zValidator(
      "json",
      z.object({ phone: z.string().regex(/^\d{10,15}$/, "E.164 sem + (ex: 556781119511)") }),
    ),
    async (c) => {
      try {
        const id = c.req.param("id");
        const provider = manager.get(id);
        if (!provider) return err(c, "NOT_FOUND", "instance not running", 404);
        const status = provider.getStatus();
        if (status === "connected") {
          return err(c, "VALIDATION", "instance already connected", 409);
        }
        const code = await provider.requestPairingCode(c.req.valid("json").phone);
        if (!code) {
          return err(
            c,
            "VALIDATION",
            "pairing code não disponível (socket já registrado)",
            409,
          );
        }
        return ok(c, { code, phone: c.req.valid("json").phone });
      } catch (e) {
        return fromException(c, e);
      }
    },
  );

  // DELETE /v1/instances/:id — logout
  app.delete("/v1/instances/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const inst = await getInstance(id);
      if (!inst) return err(c, "NOT_FOUND", "instance not found", 404);
      await manager.logoutInstance(id);
      return ok(c, { logged_out: true as const });
    } catch (e) {
      return fromException(c, e);
    }
  });

  // POST /v1/instances/:id/send
  app.post(
    "/v1/instances/:id/send",
    zValidator("json", SendMessageSchema),
    async (c) => {
      try {
        const id = c.req.param("id");
        const inst = await getInstance(id);
        if (!inst) return err(c, "NOT_FOUND", "instance not found", 404);
        if (inst.status === "banned") {
          return err(c, "INSTANCE_BANNED", "instance is banned", 409);
        }
        // Enfileira — o worker drena (defesa #10)
        const job = await enqueueOutbound(id, c.req.valid("json"));
        // A resposta aqui é 202 (accepted), mas mantemos GatewayResponse envelope.
        return ok(c, {
          queued: true as const,
          job_id: job.id,
          next_attempt_at: job.next_attempt_at,
        }, 201);
      } catch (e) {
        return fromException(c, e);
      }
    },
  );

  // GET /v1/instances/:id/chats
  app.get("/v1/instances/:id/chats", async (c) => {
    try {
      const id = c.req.param("id");
      const list = await listChats(id, {
        limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
        before: c.req.query("before"),
        archived:
          c.req.query("archived") === "true"
            ? true
            : c.req.query("archived") === "false"
              ? false
              : undefined,
      });
      return ok(c, list);
    } catch (e) {
      return fromException(c, e);
    }
  });

  // GET /v1/instances/:id/chats/:chatId/messages
  app.get("/v1/instances/:id/chats/:chatId/messages", async (c) => {
    try {
      const list = await listMessagesForChat(c.req.param("chatId"), {
        limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
        before: c.req.query("before"),
      });
      return ok(c, list);
    } catch (e) {
      return fromException(c, e);
    }
  });

  return app;
}
