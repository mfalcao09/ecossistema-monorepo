import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unwrapDEK } from "@ecossistema/magic-link-vault";
import type { VaultToken } from "@ecossistema/magic-link-vault";

// Retorna a DEK em base64 para o browser cifrar.
// A DEK é temporariamente desprotegida APENAS para o browser — TLS protege em trânsito.
// O browser usa a DEK para cifrar o plaintext; a DEK é descartada após o uso.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("vault_tokens")
    .select("token, dek_wrapped, expires_at, used")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "invalid_or_expired_token" },
      { status: 410 },
    );
  }

  const tokenRow = data as unknown as VaultToken;

  if (!tokenRow.dek_wrapped) {
    return NextResponse.json({ error: "dek_not_available" }, { status: 500 });
  }

  const kekHex = process.env.VAULT_KEK_HEX;
  if (!kekHex) {
    return NextResponse.json({ error: "kek_not_configured" }, { status: 500 });
  }

  const kekRaw = new Uint8Array(
    kekHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
  );

  let dekRaw: Uint8Array;
  try {
    dekRaw = await unwrapDEK(tokenRow.dek_wrapped, kekRaw);
  } catch {
    return NextResponse.json({ error: "kek_unwrap_failed" }, { status: 500 });
  }

  // Converte para base64 para envio ao browser
  const dek = btoa(String.fromCharCode(...dekRaw));

  return NextResponse.json({ dek });
}
