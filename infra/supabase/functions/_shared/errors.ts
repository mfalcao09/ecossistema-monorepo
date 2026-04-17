// _shared/errors.ts
// Respostas JSON padronizadas { error: { code, message, details? } }.

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function ok(body: unknown = { ok: true }, extraHeaders: Record<string, string> = {}): Response {
  return json(body, 200, extraHeaders);
}

export function err(status: number, code: string, message: string, details?: unknown): Response {
  const body: ErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return json(body, status);
}

// Atalhos comuns
export const errors = {
  badRequest: (msg: string, details?: unknown) => err(400, "bad_request", msg, details),
  unauthorized: (msg = "missing or invalid credentials") => err(401, "unauthorized", msg),
  forbidden: (code: string, msg: string, details?: unknown) => err(403, code, msg, details),
  notFound: (msg = "resource not found", details?: unknown) => err(404, "not_found", msg, details),
  methodNotAllowed: () => err(405, "method_not_allowed", "HTTP method not allowed"),
  conflict: (msg: string, details?: unknown) => err(409, "conflict", msg, details),
  rateLimited: (msg = "rate limit exceeded", details?: unknown) => err(429, "rate_limited", msg, details),
  internal: (msg = "internal error", details?: unknown) => err(500, "internal", msg, details),
  badGateway: (msg = "upstream error", details?: unknown) => err(502, "bad_gateway", msg, details),
};

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Response(JSON.stringify({ error: { code: "invalid_json", message: "request body is not valid JSON" } }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
}
