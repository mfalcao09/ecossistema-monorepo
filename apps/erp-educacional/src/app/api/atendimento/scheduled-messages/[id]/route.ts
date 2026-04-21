import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("atendimento_scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending"); // só cancela pendentes
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cancelled: true });
}
