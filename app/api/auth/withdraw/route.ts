import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

// 무료 CON으로 간주할 description 패턴
const FREE_CON_PATTERNS = ['가입 기념', '추천인', '환불', '어드민', '지급', 'superadmin', '슈퍼어드민'];

function isFreeCharge(description: string): boolean {
  return FREE_CON_PATTERNS.some(p => description.toLowerCase().includes(p.toLowerCase()));
}

export async function POST(request: NextRequest) {
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
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 유료 CON 여부 확인
  const { data: transactions } = await admin
    .from('con_transactions')
    .select('amount, description, type')
    .eq('academy_id', user.id)
    .eq('type', 'charge');

  const hasPaidCon = (transactions ?? []).some(
    tx => tx.amount > 0 && !isFreeCharge(tx.description ?? '')
  );

  if (hasPaidCon) {
    return NextResponse.json(
      { error: 'paid_con_exists' },
      { status: 400 }
    );
  }

  // 탈퇴 처리: 학원 데이터 삭제 → Auth 유저 삭제
  await admin.from('academy_config').delete().eq('user_id', user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: '탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
