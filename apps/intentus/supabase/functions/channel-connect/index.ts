import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant_id from user metadata
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      // ==================== Z-API Actions ====================
      case "zapi_create_instance": {
        const zapiAccountToken = Deno.env.get("ZAPI_ACCOUNT_TOKEN");
        const zapiAccountId = Deno.env.get("ZAPI_ACCOUNT_ID");

        if (!zapiAccountToken || !zapiAccountId) {
          return new Response(JSON.stringify({ error: "Z-API credentials not configured. Please add ZAPI_ACCOUNT_TOKEN and ZAPI_ACCOUNT_ID secrets." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { name } = payload;
        if (!name) {
          return new Response(JSON.stringify({ error: "Channel name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create Z-API instance
        const createRes = await fetch(`https://api.z-api.io/instances`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": zapiAccountToken,
          },
          body: JSON.stringify({ name: `${tenantId}_${name}` }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          console.error("Z-API create instance error:", errText);
          return new Response(JSON.stringify({ error: "Failed to create WhatsApp instance" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const instanceData = await createRes.json();
        const instanceId = instanceData.id || instanceData.instanceId;
        const instanceToken = instanceData.token || instanceData.instanceToken;

        // Save channel in database
        const { data: channel, error: insertError } = await supabase
          .from("chat_channels")
          .insert({
            name,
            channel_type: "whatsapp_nao_oficial",
            connected_via: "zapi",
            zapi_instance_id: instanceId,
            zapi_instance_token: instanceToken,
            status: "desconectado",
            tenant_id: tenantId,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Insert channel error:", insertError);
          return new Response(JSON.stringify({ error: "Failed to save channel" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ channel_id: channel.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "zapi_get_qrcode": {
        const { channel_id } = payload;
        if (!channel_id) {
          return new Response(JSON.stringify({ error: "channel_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch credentials from DB
        const { data: ch, error: chErr } = await supabase
          .from("chat_channels")
          .select("zapi_instance_id, zapi_instance_token")
          .eq("id", channel_id)
          .eq("tenant_id", tenantId)
          .single();

        if (chErr || !ch?.zapi_instance_id) {
          return new Response(JSON.stringify({ error: "Channel not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const zapiAccountToken = Deno.env.get("ZAPI_ACCOUNT_TOKEN") || "";

        const qrRes = await fetch(
          `https://api.z-api.io/instances/${ch.zapi_instance_id}/token/${ch.zapi_instance_token}/qr-code`,
          { headers: { "Client-Token": zapiAccountToken } }
        );

        if (!qrRes.ok) {
          const errText = await qrRes.text();
          console.error("Z-API QR code error:", errText);
          return new Response(JSON.stringify({ error: "Failed to get QR code", details: errText }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const qrData = await qrRes.json();
        return new Response(JSON.stringify({ qrcode: qrData.value || qrData.qrcode || qrData.base64 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "zapi_check_status": {
        const { channel_id } = payload;
        if (!channel_id) {
          return new Response(JSON.stringify({ error: "channel_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: ch, error: chErr } = await supabase
          .from("chat_channels")
          .select("zapi_instance_id, zapi_instance_token")
          .eq("id", channel_id)
          .eq("tenant_id", tenantId)
          .single();

        if (chErr || !ch?.zapi_instance_id) {
          return new Response(JSON.stringify({ error: "Channel not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const zapiAccountToken = Deno.env.get("ZAPI_ACCOUNT_TOKEN") || "";

        const statusRes = await fetch(
          `https://api.z-api.io/instances/${ch.zapi_instance_id}/token/${ch.zapi_instance_token}/status`,
          { headers: { "Client-Token": zapiAccountToken } }
        );

        if (!statusRes.ok) {
          return new Response(JSON.stringify({ connected: false, status: "error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const statusData = await statusRes.json();
        const isConnected = statusData.connected === true || statusData.status === "CONNECTED";

        // Update channel status in DB if connected
        if (isConnected) {
          await supabase
            .from("chat_channels")
            .update({
              status: "conectado",
              phone_number: statusData.phoneNumber || statusData.phone || null,
            })
            .eq("id", channel_id);
        }

        return new Response(JSON.stringify({
          connected: isConnected,
          status: isConnected ? "conectado" : "aguardando",
          phone_number: statusData.phoneNumber || statusData.phone || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "zapi_disconnect": {
        const { channel_id } = payload;
        if (!channel_id) {
          return new Response(JSON.stringify({ error: "channel_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: ch, error: chErr } = await supabase
          .from("chat_channels")
          .select("zapi_instance_id, zapi_instance_token")
          .eq("id", channel_id)
          .eq("tenant_id", tenantId)
          .single();

        if (chErr || !ch?.zapi_instance_id) {
          return new Response(JSON.stringify({ error: "Channel not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const zapiAccountToken = Deno.env.get("ZAPI_ACCOUNT_TOKEN") || "";

        await fetch(
          `https://api.z-api.io/instances/${ch.zapi_instance_id}/token/${ch.zapi_instance_token}/disconnect`,
          {
            method: "POST",
            headers: { "Client-Token": zapiAccountToken },
          }
        );

        await supabase
          .from("chat_channels")
          .update({ status: "desconectado" })
          .eq("id", channel_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==================== Hunion.io Actions ====================
      case "hunion_exchange_token": {
        const metaAppId = Deno.env.get("META_APP_ID");
        const metaAppSecret = Deno.env.get("META_APP_SECRET");
        const hunionApiKey = Deno.env.get("HUNION_API_KEY");

        if (!metaAppId || !metaAppSecret || !hunionApiKey) {
          return new Response(JSON.stringify({ error: "Meta/Hunion credentials not configured. Please add META_APP_ID, META_APP_SECRET, and HUNION_API_KEY secrets." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { code } = payload;
        if (!code) {
          return new Response(JSON.stringify({ error: "Auth code is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Exchange code for access token via Meta Graph API
        const tokenRes = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&code=${code}`
        );

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error("Meta token exchange error:", errText);
          return new Response(JSON.stringify({ error: "Failed to exchange token" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tokenData = await tokenRes.json();

        // Store the token temporarily - we'll use it in the next step
        // For now, return a session reference
        const { data: tempChannel, error: tempErr } = await supabase
          .from("chat_channels")
          .insert({
            name: "Pending Setup",
            channel_type: "whatsapp_oficial",
            connected_via: "hunion",
            access_token_encrypted: tokenData.access_token,
            token_expires_at: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
              : null,
            status: "desconectado",
            tenant_id: tenantId,
          })
          .select("id")
          .single();

        if (tempErr) {
          return new Response(JSON.stringify({ error: "Failed to store token" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ channel_id: tempChannel.id, success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "hunion_list_assets": {
        const { channel_id } = payload;
        if (!channel_id) {
          return new Response(JSON.stringify({ error: "channel_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: ch, error: chErr } = await supabase
          .from("chat_channels")
          .select("access_token_encrypted")
          .eq("id", channel_id)
          .eq("tenant_id", tenantId)
          .single();

        if (chErr || !ch?.access_token_encrypted) {
          return new Response(JSON.stringify({ error: "Channel not found or no token" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accessToken = ch.access_token_encrypted;

        // Fetch WABAs
        const wabaRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${accessToken}`
        );

        const wabaData = await wabaRes.json();

        // Fetch Pages (for Instagram/Messenger)
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,name,username}&access_token=${accessToken}`
        );

        const pagesData = await pagesRes.json();

        return new Response(JSON.stringify({
          businesses: wabaData.data || [],
          pages: pagesData.data || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "hunion_register_channel": {
        const { channel_id, name, waba_id, phone_number_id, phone_display, business_id, page_id, channel_type } = payload;

        if (!channel_id) {
          return new Response(JSON.stringify({ error: "channel_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const hunionApiKey = Deno.env.get("HUNION_API_KEY");

        // Register with Hunion if WhatsApp
        if (hunionApiKey && waba_id && phone_number_id) {
          try {
            const { data: ch } = await supabase
              .from("chat_channels")
              .select("access_token_encrypted")
              .eq("id", channel_id)
              .eq("tenant_id", tenantId)
              .single();

            if (ch?.access_token_encrypted) {
              await fetch("https://api.hunion.io/v1/channels/register", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${hunionApiKey}`,
                },
                body: JSON.stringify({
                  waba_id,
                  phone_number_id,
                  access_token: ch.access_token_encrypted,
                }),
              });
            }
          } catch (e) {
            console.error("Hunion register error:", e);
          }
        }

        // Update channel with selected assets
        const { error: updateErr } = await supabase
          .from("chat_channels")
          .update({
            name: name || "Canal Oficial",
            channel_type: channel_type || "whatsapp_oficial",
            waba_id: waba_id || null,
            meta_phone_number_id: phone_number_id || null,
            meta_business_id: business_id || null,
            meta_page_id: page_id || null,
            phone_number: phone_display || null,
            status: "conectado",
          })
          .eq("id", channel_id)
          .eq("tenant_id", tenantId);

        if (updateErr) {
          return new Response(JSON.stringify({ error: "Failed to update channel" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_meta_app_id": {
        const metaAppId = Deno.env.get("META_APP_ID");
        return new Response(JSON.stringify({ app_id: metaAppId || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("channel-connect error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
