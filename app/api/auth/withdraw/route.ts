import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

const FREE_CON_PATTERNS = ['가입 기념', '추천인', '환불', '어드민', '지급', 'superadmin', '슈퍼어드민', '신규 가입'];
const FREE_FEATURE_KEYS = new Set(['signup_bonus', 'signup_bonus_referral', 'referral_reward']);

function isFreeCharge(description: string, featureKey?: string | null): boolean {
  if (featureKey && FREE_FEATURE_KEYS.has(featureKey)) return true;
  return FREE_CON_PATTERNS.some(p => description.toLowerCase().includes(p.toLowerCase()));
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  // Authorization 헤더(Bearer) 우선 → 없으면 쿠키 세션 사용
  let user: { id: string } | null = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await admin.auth.getUser(token);
    user = data.user;
  }

  if (!user) {
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
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // 유료 CON 여부 확인
  // 단순히 "유료 충전 이력이 있는지"만 보면, 카드결제 후 환불된 건도 충전 기록 자체는
  // 남아있어 영구히 탈퇴가 막히는 문제가 있었음(카드결제→환불을 반복한 계정 등).
  // 환불(type='deduct', feature_key='payapp_refund')로 상쇄된 금액을 차감한 "순 유료 충전액"과
  // 현재 실제 잔액을 함께 확인해, 둘 다 남아있을 때만(=환불도 안 됐고 아직 쓰지도 않은 유료 CON이
  // 실제로 남아있을 때만) 탈퇴를 막는다.
  const { data: transactions } = await admin
    .from('con_transactions')
    .select('amount, description, type, feature_key')
    .eq('academy_id', user.id);

  let netPaidCon = 0;
  for (const tx of transactions ?? []) {
    if (tx.type === 'charge' && tx.amount > 0 && !isFreeCharge(tx.description ?? '', tx.feature_key)) {
      netPaidCon += tx.amount;
    } else if (tx.type === 'deduct' && tx.feature_key === 'payapp_refund') {
      netPaidCon -= tx.amount;
    }
  }

  const { data: cfg } = await admin.from('academy_config').select('points').eq('user_id', user.id).single();
  const currentBalance = cfg?.points ?? 0;

  const hasPaidCon = netPaidCon > 0 && currentBalance > 0;

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
