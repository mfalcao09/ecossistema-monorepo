import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SocialPost {
  id: string;
  platform: string;
  post_id: string;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
}

export function useSocialFeed() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["social-feed", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_feed_cache")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as unknown as SocialPost[];
    },
    staleTime: 300_000,
  });
}
