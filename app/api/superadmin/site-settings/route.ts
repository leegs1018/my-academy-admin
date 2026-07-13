import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const keys = request.nextUrl.searchParams.get('keys')?.split(',').filter(Boolean) ?? [];
  if (!keys.length) return NextResponse.json({ settings: {} });

  const { data, error } = await adminClient()
    .from('site_settings')
    .select('key, value')
    .in('key', keys);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, string> = {};
  (data ?? []).forEach(row => { settings[row.key] = row.value; });
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  try {
    const { settings } = await request.json() as { settings: Record<string, string> };
    const upsertData = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await adminClient()
      .from('site_settings')
      .upsert(upsertData, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}
