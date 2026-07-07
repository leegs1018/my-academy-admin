import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 신규 가입 보너스 CON을 con_transactions에 기록
// RegisterContent / complete-profile 에서 가입 직후 호출
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = auth.slice(7);

  const db = createAdminClient();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const { base_amount, referral_amount } = await request.json();

    // 중복 방지: signup_bonus 트랜잭션이 이미 있으면 skip
    const { data: existing } = await db
      .from('con_transactions')
      .select('id')
      .eq('academy_id', user.id)
      .eq('feature_key', 'signup_bonus')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // 현재 잔액 조회
    const { data: academy } = await db
      .from('academy_config')
      .select('points')
      .eq('user_id', user.id)
      .single();

    const totalPoints = academy?.points ?? (base_amount + (referral_amount ?? 0));

    // 기본 가입 보너스 기록
    await db.from('con_transactions').insert({
      academy_id: user.id,
      type: 'charge',
      amount: base_amount,
      balance_after: base_amount,
      feature_key: 'signup_bonus',
      description: '신규 가입 보너스',
    });

    // 추천인 코드 입력 보너스 기록 (있을 경우)
    if (referral_amount && referral_amount > 0) {
      await db.from('con_transactions').insert({
        academy_id: user.id,
        type: 'charge',
        amount: referral_amount,
        balance_after: totalPoints,
        feature_key: 'signup_bonus_referral',
        description: '추천인 코드 입력 보너스',
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
