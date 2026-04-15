import { NextResponse } from "next/server";

// DEPRECATED — Migração em lote removida
// A funcionalidade foi substituída por processos individuais via /diploma/processos/[id]

export async function POST() {
  return NextResponse.json(
    { error: "Migração em lote foi descontinuada. Use processos individuais." },
    { status: 410 }
  );
}
