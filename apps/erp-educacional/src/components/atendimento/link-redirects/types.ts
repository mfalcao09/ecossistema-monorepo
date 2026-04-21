export type DistributionMode = "sequential" | "random" | "ordered" | "by_hour";

export interface LinkNumber {
  number: string;
  label?: string;
  weight?: number;
  active?: boolean;
}

export interface LinkRedirect {
  id: string;
  slug: string;
  name: string;
  greeting: string | null;
  numbers: LinkNumber[];
  distribution: DistributionMode;
  schedule_config: {
    order?: number[];
    ranges?: Record<string, number>;
    tz?: string;
  };
  cursor_idx: number;
  total_clicks: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatsResponse {
  link: { id: string; slug: string; name: string; total_clicks: number };
  window_days: number;
  total_in_window: number;
  daily: { day: string; count: number }[];
  by_number: { index: number; number: string; label: string | null; count: number }[];
  by_utm_source: { source: string; count: number }[];
  recent: Array<{
    created_at: string;
    selected_index: number | null;
    selected_number: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    country: string | null;
    user_agent: string | null;
    referer: string | null;
  }>;
}
