import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tenant settings to find instagram token
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settings = tenant.settings as Record<string, any> | null;
    const instagramToken = settings?.instagram_token;

    if (!instagramToken) {
      return new Response(
        JSON.stringify({ error: "Instagram token not configured", code: "NO_TOKEN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache freshness (1 hour)
    const { data: cached } = await supabase
      .from("social_feed_cache")
      .select("fetched_at")
      .eq("tenant_id", tenant_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < 3600_000) {
        return new Response(JSON.stringify({ status: "cached", message: "Cache is fresh" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch from Instagram Graph API
    const igUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp&limit=6&access_token=${instagramToken}`;
    const igResponse = await fetch(igUrl);

    if (!igResponse.ok) {
      const igError = await igResponse.text();
      console.error("Instagram API error:", igError);
      return new Response(
        JSON.stringify({ error: "Instagram API error", details: igError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const igData = await igResponse.json();
    const posts = igData.data || [];

    // Upsert into cache
    for (const post of posts) {
      await supabase.from("social_feed_cache").upsert(
        {
          tenant_id,
          platform: "instagram",
          post_id: post.id,
          media_url: post.media_url || null,
          thumbnail_url: post.thumbnail_url || null,
          caption: post.caption || null,
          permalink: post.permalink || null,
          posted_at: post.timestamp || null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,post_id" }
      );
    }

    return new Response(
      JSON.stringify({ status: "refreshed", count: posts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-social-feed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
