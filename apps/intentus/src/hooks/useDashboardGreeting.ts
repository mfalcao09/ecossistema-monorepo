import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export function useDashboardGreeting() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    staleTime: 300_000,
  });

  return useMemo(() => {
    const now = new Date();
    const greeting = getGreeting();
    const firstName = (profile?.name || user?.email || "").split(" ")[0].split("@")[0];
    const dayOfWeek = format(now, "EEEE", { locale: ptBR });
    const fullDate = format(now, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

    return {
      greeting,
      firstName,
      dayOfWeek: capitalizedDay,
      fullDate,
      dateLabel: `${capitalizedDay}, ${fullDate}`,
    };
  }, [profile?.name, user?.email]);
}
