import { NextRequest, NextResponse } from "next/server";
import type { EncryptedPayload } from "@ecossistema/magic-link-vault";

// Proxy para a Edge Function collect-secret.
// Delega validação e armazenamento para a EF (Deno) que tem acesso ao service_role.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { token: string; encrypted_payload: EncryptedPayload };
  try {
    body = (await req.json()) as {
      token: string;
      encrypted_payload: EncryptedPayload;
    };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { token, encrypted_payload } = body;
  if (!token || !encrypted_payload?.ciphertext || !encrypted_payload?.iv) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const efResp = await fetch(`${supabaseUrl}/functions/v1/collect-secret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      "X-Forwarded-For": req.headers.get("x-forwarded-for") ?? "",
    },
    body: JSON.stringify({ token, encrypted_payload }),
  });

  if (!efResp.ok) {
    const errBody = (await efResp
      .json()
      .catch(() => ({ error: "ef_error" }))) as { error: string };
    return NextResponse.json(errBody, { status: efResp.status });
  }

  return NextResponse.json({ status: "stored" });
}
