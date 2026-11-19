import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendPpurioSms } from '@/lib/ppurio';

// pay_state=4: 결제 완료, pay_state=64: 환불/취소
const REFUND_STATES = new Set(['3', '5', '64']);

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

  // 모든 파라미터 로그 (페이앱이 어떤 데이터를 보내는지 확인용)
  console.log('[payapp/callback] 수신 데이터:', JSON.stringify(body));

  const { linkkey, linkval, pay_state, mul_no, var1: userId, var2: conAmountStr, var3: priceWonStr } = body;

  // 연동 KEY/VALUE 검증
  if (linkkey !== process.env.PAYAPP_LINKKEY || linkval !== process.env.PAYAPP_LINKVAL) {
    console.error('[payapp/callback] 인증 실패 - 수신 linkkey:', linkkey, '/ 수신 linkval:', linkval);
    return new Response('FAIL', { status: 400 });
  }

  const supabase = createAdminClient();

  // ── 결제 완료 처리 (pay_state=4) ──────────────────
  if (pay_state === '4') {
    if (!userId || !conAmountStr || !mul_no) {
      return new Response('FAIL', { status: 400 });
    }

    const totalCon = parseInt(conAmountStr);
    if (isNaN(totalCon) || totalCon <= 0) return new Response('FAIL', { status: 400 });

    // var3(실결제 금액)을 PayApp이 그대로 돌려주지 않는 경우가 있어,
    // 요청 시점에 저장해둔 payapp_pending_charges에서 academy_id + CON수량으로 매칭해 복구한다.
    let priceWon = priceWonStr ? parseInt(priceWonStr) : null;
    if (priceWon === null || isNaN(priceWon)) {
      const { data: pending } = await supabase
        .from('payapp_pending_charges')
        .select('id, price_won')
        .eq('academy_id', userId)
        .eq('con_amount', totalCon)
        .eq('consumed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pending) {
        priceWon = pending.price_won;
        await supabase.from('payapp_pending_charges').update({ consumed: true }).eq('id', pending.id);
      } else {
        priceWon = null;
      }
    } else {
      // var3가 정상적으로 왔으면, 매칭되는 pending 기록을 소모 처리해 누적되지 않게 한다.
      await supabase
        .from('payapp_pending_charges')
        .update({ consumed: true })
        .eq('academy_id', userId)
        .eq('con_amount', totalCon)
        .eq('consumed', false);
    }

    const dupKey = `[카드결제] ${mul_no}`;

    // 중복 방지
    const { data: existing } = await supabase
      .from('con_transactions')
      .select('id')
      .eq('description', dupKey)
      .maybeSingle();

    if (existing) {
      console.log('[payapp/callback] 중복 결제 무시:', mul_no);
      return new Response('SUCCESS', { status: 200 });
    }

    const { error } = await supabase.rpc('charge_con', {
      p_academy_id: userId,
      p_amount: totalCon,
      p_description: dupKey,
      p_created_by: 'payapp',
      p_feature_key: 'payapp_charge',
      p_is_free: false,
      p_amount_krw: priceWon,
    });

    if (error) {
      console.error('[payapp/callback] charge_con 실패:', error);
      return new Response('FAIL', { status: 500 });
    }

    console.log('[payapp/callback] CON 충전 완료:', userId, totalCon, 'CON');

    // 관리자 CON 결제 알림 SMS
    try {
      const { data: notifySetting } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'admin_notify_phone')
        .single();
      const adminPhone = notifySetting?.value?.trim();
      if (adminPhone) {
        const { data: academyData } = await supabase
          .from('academy_config')
          .select('academy_name')
          .eq('user_id', userId)
          .single();
        const name = academyData?.academy_name || userId;
        await sendPpurioSms(adminPhone, `[CON EDU] 콘 충전\n${name}\n${totalCon}콘 충전`);
      }
    } catch {
      // 알림 실패는 결제 처리에 영향 없음
    }

    return new Response('SUCCESS', { status: 200 });
  }

  // ── 취소/환불 처리 (pay_state=3 or 5) ─────────────
  if (REFUND_STATES.has(pay_state)) {
    if (!mul_no) return new Response('FAIL', { status: 400 });

    const chargeKey = `[카드결제] ${mul_no}`;
    const refundKey = `[카드결제 환불] ${mul_no}`;

    // 이미 환불 처리됐는지 확인
    const { data: alreadyRefunded } = await supabase
      .from('con_transactions')
      .select('id')
      .eq('description', refundKey)
      .maybeSingle();

    if (alreadyRefunded) {
      return new Response('SUCCESS', { status: 200 });
    }

    // 원래 충전 내역 조회
    const { data: originalCharge } = await supabase
      .from('con_transactions')
      .select('academy_id, amount, amount_krw')
      .eq('description', chargeKey)
      .maybeSingle();

    if (!originalCharge) {
      console.log('[payapp/callback] 원본 충전 내역 없음, 환불 스킵:', mul_no);
      return new Response('SUCCESS', { status: 200 });
    }

    const { error } = await supabase.rpc('deduct_con', {
      p_academy_id: originalCharge.academy_id,
      p_amount: originalCharge.amount,
      p_feature_key: 'payapp_refund',
      p_description: refundKey,
      p_amount_krw: originalCharge.amount_krw,
    });

    if (error) {
      console.error('[payapp/callback] deduct_con(환불) 실패:', error);
      return new Response('FAIL', { status: 500 });
    }

    console.log('[payapp/callback] CON 환불 처리:', originalCharge.academy_id, originalCharge.amount, 'CON');
    return new Response('SUCCESS', { status: 200 });
  }

  // 그 외 상태는 무시
  console.log('[payapp/callback] 처리 불필요한 pay_state:', pay_state);
  return new Response('SUCCESS', { status: 200 });
}
