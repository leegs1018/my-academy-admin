import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = auth.slice(7);

  const db = createAdminClient();

  // 신규 가입자 JWT 검증
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const referralCode = (body.referral_code || '').trim().toUpperCase();
    if (!referralCode) return NextResponse.json({ error: 'Missing referral_code' }, { status: 400 });

    // 추천인 보상 단가 조회 (default 100)
    const { data: rewardPricing } = await db
      .from('con_pricing')
      .select('cost_per_use')
      .eq('feature_key', 'referral_reward')
      .eq('is_active', true)
      .single();
    const rewardAmount = rewardPricing?.cost_per_use ?? 100;

    // 추천인 조회
    const { data: referrer } = await db
      .from('academy_config')
      .select('user_id, points')
      .eq('own_referral_code', referralCode)
      .single();

    if (!referrer) return NextResponse.json({ error: 'Referrer not found' }, { status: 404 });
    if (referrer.user_id === user.id) return NextResponse.json({ error: 'Self-referral not allowed' }, { status: 400 });

    const newPoints = (referrer.points ?? 0) + rewardAmount;

    await db.from('academy_config').update({ points: newPoints }).eq('user_id', referrer.user_id);

    await db.from('con_transactions').insert({
      academy_id: referrer.user_id,
      type: 'charge',
      amount: rewardAmount,
      balance_after: newPoints,
      feature_key: 'referral_reward',
      description: '추천인 코드 신규 가입 보상',
    });

    return NextResponse.json({ success: true, rewarded: rewardAmount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
