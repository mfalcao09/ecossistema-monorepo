"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function saudacao(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDatePt(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function DashboardHeader() {
  const [name, setName] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display =
        (u?.user_metadata?.full_name as string | undefined) ||
        (u?.user_metadata?.name as string | undefined) ||
        u?.email?.split("@")[0] ||
        null;
      setName(display);
    });
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {saudacao(now.getHours())}
          {name ? `, ${name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Central de Atendimento — {formatDatePt(now)}
        </p>
      </div>
    </div>
  );
}
