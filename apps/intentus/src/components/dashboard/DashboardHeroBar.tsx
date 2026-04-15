import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Wind, Droplets } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDashboardGreeting } from "@/hooks/useDashboardGreeting";
import { useWeather } from "@/hooks/useWeather";

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function DashboardHeroBar() {
  const { greeting, firstName, dateLabel } = useDashboardGreeting();
  const { data: weather, isLoading: weatherLoading } = useWeather();
  const now = useLiveClock();

  const timeStr = format(now, "HH:mm:ss");
  const weekday = format(now, "EEEE", { locale: ptBR });
  const fullDate = format(now, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedDay = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Orange accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/80 via-primary to-primary/20" />

      <div className="relative flex items-center justify-between gap-6 px-6 py-5">
        {/* Left: greeting */}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {greeting}, <span className="text-primary">{firstName}</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm">{capitalizedDay}, {fullDate}</span>
          </div>
        </div>

        {/* Right: clock + weather */}
        <div className="flex items-center gap-5 shrink-0">
          {/* Live clock */}
          <div className="text-right hidden sm:block">
            <div
              className="text-2xl font-medium text-foreground tracking-widest"
              style={{ fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums" }}
            >
              {timeStr}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Horário local</div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-10 bg-border" />

          {/* Weather */}
          {!weatherLoading && weather ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label={weather.condition}>
                {weather.icon}
              </span>
              <div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-2xl font-medium text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {weather.temperature}°C
                  </span>
                  <span className="text-xs text-muted-foreground">{weather.condition}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {weather.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {weather.humidity}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Wind className="h-3 w-3" />
                    {weather.windSpeed} km/h
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-28 h-10 rounded-lg bg-muted/40 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
