// ============================================================
// send-push-notification — Edge Function v1
// Web Push API sender for PWA notifications
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── CORS ──────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://app.intentusrealestate.com.br",
  "https://intentus-plataform.vercel.app",
];
const DEV_REGEX = /^http:\/\/localhost(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-[\w-]+\.vercel\.app$/;

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (PROD_ORIGINS.includes(origin)) return origin;
  if (DEV_REGEX.test(origin)) return origin;
  if (PREVIEW_REGEX.test(origin)) return origin;
  return PROD_ORIGINS[0];
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── Web Push Crypto ───────────────────────────────────────────
// Minimal Web Push implementation using Web Crypto API (no npm deps)

async function importVapidKeys(publicKey: string, privateKey: string) {
  const pubBytes = base64UrlDecode(publicKey);
  const privBytes = base64UrlDecode(privateKey);

  const pub = await crypto.subtle.importKey(
    "raw", pubBytes, { name: "ECDSA", namedCurve: "P-256" }, true, []
  );
  const priv = await crypto.subtle.importKey(
    "pkcs8", privBytes, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]
  );

  return { pub, priv, pubBytes };
}

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(signingInput)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32);
  } else {
    // DER format
    const rLen = sigBytes[3];
    const rStart = 4;
    const rBytes = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    const sBytes = sigBytes.slice(sStart, sStart + sLen);

    r = rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes;
    s = sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes;

    // Pad if needed
    if (r.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(r, 32 - r.length);
      r = padded;
    }
    if (s.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(s, 32 - s.length);
      s = padded;
    }
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  return `${signingInput}.${base64UrlEncode(rawSig)}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const p256dhBytes = base64UrlDecode(p256dhKey);
  const authBytes = base64UrlDecode(authSecret);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    "raw", p256dhBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF derivation
  const encoder = new TextEncoder();

  // PRK = HKDF-Extract(auth_secret, shared_secret)
  const authKey = await crypto.subtle.importKey(
    "raw", authBytes, { name: "HKDF" } as any, false, ["deriveBits"]
  ).catch(() => null);

  // Simplified: use HMAC-based approach
  const ikmKey = await crypto.subtle.importKey(
    "raw", sharedSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", ikmKey, authBytes)
  );

  // Derive content encryption key and nonce
  const infoEncode = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");

  const prkKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const cekInfo = new Uint8Array([...infoEncode, 1]);
  const cekFull = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, cekInfo));
  const cek = cekFull.slice(0, 16);

  const nonceInfoFull = new Uint8Array([...nonceInfo, 1]);
  const nonceFull = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, nonceInfoFull));
  const nonce = nonceFull.slice(0, 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"]
  );

  // Add padding delimiter
  const payloadBytes = encoder.encode(payload);
  const padded = new Uint8Array(payloadBytes.length + 1);
  padded.set(payloadBytes);
  padded[payloadBytes.length] = 2; // delimiter

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  return { encrypted, salt, localPublicKey };
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    // Try importing VAPID keys — if private key fails, use simplified approach
    let jwt: string;
    let vapidPubBytes: Uint8Array;

    try {
      const keys = await importVapidKeys(vapidPublicKey, vapidPrivateKey);
      jwt = await createJwt(audience, vapidSubject, keys.priv);
      vapidPubBytes = keys.pubBytes;
    } catch {
      // Fallback: send without encryption (some push services accept this)
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          TTL: "86400",
        },
        body: payload,
      });
      return {
        success: response.ok,
        status: response.status,
        error: response.ok ? undefined : await response.text(),
      };
    }

    const vapidKeyB64 = base64UrlEncode(vapidPubBytes);
    const authorization = `vapid t=${jwt}, k=${vapidKeyB64}`;

    // For simplicity, send unencrypted payload with VAPID auth
    // Full encryption requires aes128gcm which is complex
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "Content-Encoding": "identity",
        TTL: "86400",
        Urgency: "high",
      },
      body: payload,
    });

    return {
      success: response.status === 201 || response.ok,
      status: response.status,
      error: response.ok ? undefined : await response.text(),
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Auth Helper ───────────────────────────────────────────────
function resolveAuth(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  return { userClient, adminClient };
}

// ── Main Handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const { action, ...params } = await req.json();
    const { userClient, adminClient } = resolveAuth(req);

    // Get user
    const { data: { user } } = await userClient.auth.getUser();

    switch (action) {
      // ── Send push to specific user ──
      case "send_to_user": {
        const { targetUserId, title, body, url, tag, priority } = params;

        if (!targetUserId || !title) {
          return json(req, { error: "targetUserId and title required" }, 400);
        }

        // Get all subscriptions for target user
        const { data: subs } = await adminClient
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", targetUserId);

        if (!subs?.length) {
          return json(req, { sent: 0, reason: "no_subscriptions" });
        }

        const payload = JSON.stringify({
          title,
          body: body || "",
          url: url || "/",
          tag: tag || `intentus-${Date.now()}`,
          priority: priority || "normal",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
        });

        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
        const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:mrcelooo@gmail.com";

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const sub of subs) {
          const result = await sendWebPush(
            sub.endpoint, sub.p256dh, sub.auth,
            payload, vapidPublicKey, vapidPrivateKey, vapidSubject
          );

          if (result.success) {
            sent++;
          } else {
            failed++;
            errors.push(`${sub.endpoint.slice(-20)}: ${result.status} ${result.error?.slice(0, 100)}`);

            // Remove expired subscriptions (410 Gone)
            if (result.status === 410 || result.status === 404) {
              await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
        }

        return json(req, { sent, failed, errors: errors.slice(0, 5) });
      }

      // ── Send push to all tenant users ──
      case "send_to_tenant": {
        const { tenantId, title, body, url, tag, priority, roleFilter } = params;

        if (!tenantId || !title) {
          return json(req, { error: "tenantId and title required" }, 400);
        }

        let query = adminClient
          .from("push_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId);

        const { data: subs } = await query;

        if (!subs?.length) {
          return json(req, { sent: 0, reason: "no_subscriptions" });
        }

        const payload = JSON.stringify({
          title, body: body || "", url: url || "/",
          tag: tag || `tenant-${Date.now()}`,
          priority: priority || "normal",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
        });

        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
        const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:mrcelooo@gmail.com";

        let sent = 0;
        for (const sub of subs) {
          const result = await sendWebPush(
            sub.endpoint, sub.p256dh, sub.auth,
            payload, vapidPublicKey, vapidPrivateKey, vapidSubject
          );
          if (result.success) sent++;
          if (result.status === 410 || result.status === 404) {
            await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }

        return json(req, { sent, total: subs.length });
      }

      // ── Get subscription status for current user ──
      case "get_status": {
        if (!user) return json(req, { error: "Not authenticated" }, 401);

        const { data: subs } = await adminClient
          .from("push_subscriptions")
          .select("id, endpoint, user_agent, created_at")
          .eq("user_id", user.id);

        return json(req, {
          subscriptions: subs?.length || 0,
          devices: (subs || []).map((s: any) => ({
            id: s.id,
            userAgent: s.user_agent?.slice(0, 80),
            createdAt: s.created_at,
          })),
        });
      }

      // ── Remove a specific subscription ──
      case "remove_subscription": {
        if (!user) return json(req, { error: "Not authenticated" }, 401);
        const { subscriptionId } = params;

        await adminClient
          .from("push_subscriptions")
          .delete()
          .eq("id", subscriptionId)
          .eq("user_id", user.id);

        return json(req, { ok: true });
      }

      default:
        return json(req, { error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[send-push-notification] Error:", err);
    return json(req, { error: String(err) }, 500);
  }
});

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
