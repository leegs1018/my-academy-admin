import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from '../_auth';

const KEYS = ['PPURIO_API_KEY', 'PPURIO_ACCOUNT', 'KAKAO_SENDER_KEY', 'KAKAO_TEMPLATE_ATTENDANCE_ID', 'KAKAO_TEMPLATE_GRADE_ID'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authErr = await requireSuperAdmin(req);
  if (authErr) return authErr;

  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', KEYS);

  const config: Record<string, string> = {};
  (data ?? []).forEach(row => { config[row.key] = row.value; });
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const authErr = await requireSuperAdmin(req);
  if (authErr) return authErr;

  const { key, value } = await req.json();
  if (!KEYS.includes(key)) return NextResponse.json({ error: '유효하지 않은 키' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('site_settings')
    .upsert({ key, value: value?.trim() ?? '' }, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
