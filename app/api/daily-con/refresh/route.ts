import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD (KST 기준)
  const db = createAdminClient();

  const { data } = await db
    .from('academy_config')
    .select('points, daily_con_balance, daily_con_date')
    .eq('user_id', user.id)
    .single();

  if (!data) return NextResponse.json({ error: '학원 정보 없음' }, { status: 404 });

  let dailyConBalance: number = data.daily_con_balance ?? 0;

  if (data.daily_con_date !== today) {
    dailyConBalance = 100;
    await db
      .from('academy_config')
      .update({ daily_con_balance: 100, daily_con_date: today })
      .eq('user_id', user.id);

    // 지급 이력 기록
    await db.from('con_transactions').insert({
      academy_id: user.id,
      type: 'charge',
      amount: 100,
      feature_key: 'daily_free',
      description: `무료 CON 일일 지급 (${today})`,
    });
  }

  return NextResponse.json({
    points: data.points ?? 0,
    daily_con_balance: dailyConBalance,
  });
}
