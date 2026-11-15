import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

/** Verify the same cookie/server boundary used by the protected layout before navigating. */
export async function GET() {
  try {
    const client = await supabaseServer();
    const { data, error } = await client.auth.getUser();
    if (error) {
      const status = 'status' in error ? Number(error.status) : 0;
      const retryable = !status || status >= 500;
      return NextResponse.json({ authenticated: false }, { status: retryable ? 503 : 401, headers });
    }
    return NextResponse.json({ authenticated: !!data.user }, { status: data.user ? 200 : 401, headers });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 503, headers });
  }
}
