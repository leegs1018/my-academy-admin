import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = await req.json();
    }
  } catch {
    return new Response('FAIL', { status: 400 });
  }

  const { linkkey, linkval, pay_state, mul_no, var1: userId, var2: conAmountStr } = body;

  // 연동 KEY/VALUE 검증
  if (linkkey !== process.env.PAYAPP_LINKKEY || linkval !== process.env.PAYAPP_LINKVAL) {
    console.error('[payapp/callback] 인증 실패 - linkkey 불일치');
    return new Response('FAIL', { status: 400 });
  }

  // 결제 완료(pay_state=4)만 처리
  if (pay_state !== '4') {
    console.log('[payapp/callback] 결제 완료 아님, pay_state:', pay_state);
    return new Response('SUCCESS', { status: 200 });
  }

  if (!userId || !conAmountStr || !mul_no) {
    console.error('[payapp/callback] 필수 파라미터 누락');
    return new Response('FAIL', { status: 400 });
  }

  const totalCon = parseInt(conAmountStr);
  if (isNaN(totalCon) || totalCon <= 0) {
    console.error('[payapp/callback] 잘못된 CON 금액:', conAmountStr);
    return new Response('FAIL', { status: 400 });
  }

  const supabase = createAdminClient();
  const dupKey = `[카드결제] ${mul_no}`;

  // 중복 결제 방지
  const { data: existing } = await supabase
    .from('con_transactions')
    .select('id')
    .eq('description', dupKey)
    .maybeSingle();

  if (existing) {
    console.log('[payapp/callback] 중복 결제 무시:', mul_no);
    return new Response('SUCCESS', { status: 200 });
  }

  // 현재 잔액 조회
  const { data: cfg } = await supabase
    .from('academy_config')
    .select('points')
    .eq('user_id', userId)
    .single();

  if (!cfg) {
    console.error('[payapp/callback] 사용자 없음:', userId);
    return new Response('FAIL', { status: 400 });
  }

  const currentPoints = cfg.points ?? 0;
  const newPoints = currentPoints + totalCon;

  // 포인트 업데이트
  const { error: updateError } = await supabase
    .from('academy_config')
    .update({ points: newPoints })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[payapp/callback] 포인트 업데이트 실패:', updateError);
    return new Response('FAIL', { status: 500 });
  }

  // 거래 이력 기록
  await supabase.from('con_transactions').insert({
    academy_id: userId,
    type: 'charge',
    amount: totalCon,
    balance_after: newPoints,
    description: dupKey,
    feature_key: 'payapp_charge',
    is_free: false,
  });

  console.log('[payapp/callback] CON 충전 완료:', userId, totalCon, 'CON, 잔액:', newPoints);
  return new Response('SUCCESS', { status: 200 });
}
