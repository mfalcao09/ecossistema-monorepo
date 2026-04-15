import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get('property_id');
    const token = url.searchParams.get('token');

    if (!propertyId || !token) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate token
    const { data: tokenData, error: tokenErr } = await supabase
      .from('property_document_tokens')
      .select('*')
      .eq('property_id', propertyId)
      .eq('token', token)
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: 'Link inválido ou expirado.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Este link expirou.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load property
    const { data: property } = await supabase
      .from('properties')
      .select('title, address, city, state, neighborhood')
      .eq('id', propertyId)
      .single();

    // Load documents (exclude archived)
    const { data: documents, error: docsErr } = await supabase
      .from('property_documents')
      .select('id, title, document_type, document_category, status, file_path, notes, expires_at, created_at, version')
      .eq('property_id', propertyId)
      .neq('status', 'arquivado')
      .order('created_at', { ascending: false });

    if (docsErr) throw docsErr;

    // Generate signed URLs for each document (60 min)
    const docsWithUrls = await Promise.all((documents || []).map(async (doc) => {
      if (!doc.file_path) return { ...doc, file_url: null };
      const { data: signed } = await supabase.storage
        .from('property-docs')
        .createSignedUrl(doc.file_path, 3600);
      return { ...doc, file_url: signed?.signedUrl || null };
    }));

    return new Response(JSON.stringify({ property, documents: docsWithUrls }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
