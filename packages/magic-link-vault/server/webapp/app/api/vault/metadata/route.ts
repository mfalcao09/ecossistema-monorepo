import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { minutesUntilExpiry, isTokenValid } from '@ecossistema/magic-link-vault';
import type { VaultToken, TokenMetadata } from '@ecossistema/magic-link-vault';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('vault_tokens')
    .select('token, credential_name, scope, expires_at, used')
    .eq('token', token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const tokenRow = data as unknown as VaultToken;

  if (!isTokenValid(tokenRow)) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 410 });
  }

  const metadata: TokenMetadata = {
    credential_name: tokenRow.credential_name,
    scope: tokenRow.scope,
    expires_at: tokenRow.expires_at,
    expires_in_minutes: minutesUntilExpiry(tokenRow),
  };

  return NextResponse.json(metadata);
}
