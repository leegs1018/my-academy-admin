import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendPpurioSms } from '@/lib/ppurio';

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

    // 관리자 신규 가입 알림 SMS
    try {
      const { data: notifySetting } = await db
        .from('site_settings')
        .select('value')
        .eq('key', 'admin_notify_phone')
        .single();
      const adminPhone = notifySetting?.value?.trim();
      if (adminPhone) {
        const { data: academyData } = await db
          .from('academy_config')
          .select('academy_name')
          .eq('user_id', user.id)
          .single();
        const name = academyData?.academy_name || user.email || '(미입력)';
        await sendPpurioSms(
          adminPhone,
          `[CON EDU] 신규 가입\n학원명: ${name}`,
        );
      }
    } catch {
      // 알림 실패는 가입 자체에 영향 없음
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
