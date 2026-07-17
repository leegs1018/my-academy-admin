import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// pay_state=4: 결제 완료, pay_state=3: 취소, pay_state=5: 환불
const REFUND_STATES = new Set(['3', '5']);

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

  const { linkkey, linkval, pay_state, mul_no, var1: userId, var2: conAmountStr } = body;

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
    });

    if (error) {
      console.error('[payapp/callback] charge_con 실패:', error);
      return new Response('FAIL', { status: 500 });
    }

    console.log('[payapp/callback] CON 충전 완료:', userId, totalCon, 'CON');
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
      .select('academy_id, amount')
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
