import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  // 슈퍼어드민 이메일 조회 (로그 기록용)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  const { academy_id, amount, description } = await request.json() as {
    academy_id: string;
    amount: number;
    description: string;
  };

  if (!academy_id || !amount || amount <= 0) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc('charge_con', {
    p_academy_id: academy_id,
    p_amount: amount,
    p_description: description || `슈퍼어드민 충전 (${amount} CON)`,
    p_created_by: user?.email ?? 'superadmin',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, new_balance: data });
}
