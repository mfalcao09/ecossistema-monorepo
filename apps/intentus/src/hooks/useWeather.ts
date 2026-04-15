import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

function getWeatherIcon(code: number): { icon: string; condition: string } {
  if (code === 0) return { icon: "☀️", condition: "Ensolarado" };
  if (code <= 2) return { icon: "⛅", condition: "Parcialmente nublado" };
  if (code === 3) return { icon: "☁️", condition: "Nublado" };
  if (code <= 49) return { icon: "🌫️", condition: "Névoa" };
  if (code <= 59) return { icon: "🌦️", condition: "Garoa" };
  if (code <= 69) return { icon: "🌧️", condition: "Chuva" };
  if (code <= 79) return { icon: "🌨️", condition: "Neve" };
  if (code <= 82) return { icon: "🌧️", condition: "Chuva forte" };
  if (code <= 99) return { icon: "⛈️", condition: "Tempestade" };
  return { icon: "🌡️", condition: "Variável" };
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`
    );
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude };
  } catch {
    return null;
  }
}

async function fetchWeather(lat: number, lon: number): Promise<{ temperature: number; code: number; humidity: number; windSpeed: number }> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
  );
  const data = await res.json();
  const c = data.current;
  return {
    temperature: Math.round(c.temperature_2m),
    code: c.weather_code,
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m),
  };
}

export function useWeather() {
  const { tenantId } = useAuth();

  const { data: tenantCity } = useQuery({
    queryKey: ["tenant-city", tenantId],
    enabled: !!tenantId,
    staleTime: 3_600_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId!)
        .single();
      return (data?.settings as any)?.cidade || "São Paulo";
    },
  });

  return useQuery<WeatherData>({
    queryKey: ["weather", tenantCity],
    enabled: !!tenantCity,
    staleTime: 1_800_000, // 30 min
    refetchInterval: 1_800_000,
    queryFn: async () => {
      const city = tenantCity!;
      const coords = await geocodeCity(city);
      if (!coords) throw new Error("Cidade não encontrada");
      const w = await fetchWeather(coords.lat, coords.lon);
      const { icon, condition } = getWeatherIcon(w.code);
      return {
        city,
        temperature: w.temperature,
        condition,
        icon,
        humidity: w.humidity,
        windSpeed: w.windSpeed,
      };
    },
  });
}
