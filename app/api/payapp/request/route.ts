import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

function getBonus(amount: number) {
  if (amount >= 10000) return 10;
  if (amount >= 5000) return 7;
  if (amount >= 3000) return 5;
  return 0;
}

export async function POST(req: NextRequest) {
  const { userId, conAmount } = await req.json() as { userId: string; conAmount: number };

  if (!userId || !conAmount || conAmount < 100) {
    return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: cfg } = await supabase
    .from('academy_config')
    .select('ppurio_sender_number')
    .eq('user_id', userId)
    .single();

  if (!cfg) {
    return NextResponse.json({ ok: false, error: '사용자를 찾을 수 없습니다' }, { status: 404 });
  }

  const bonusCon = Math.floor(conAmount * getBonus(conAmount) / 100);
  const totalCon = conAmount + bonusCon;
  const priceWon = conAmount * 10; // 1 CON = 10원

  const phone = (cfg.ppurio_sender_number || process.env.PAYAPP_RECVPHONE || '01000000000').replace(/[- ]/g, '');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://conedu.ai.kr';

  const params = new URLSearchParams({
    cmd: 'payrequest',
    userid: process.env.PAYAPP_USERID!,
    goodname: `CON ${conAmount.toLocaleString()}개 충전`,
    price: String(priceWon),
    recvphone: phone,
    feedbackurl: `${baseUrl}/api/payapp/callback`,
    returnurl: `${baseUrl}/admin/con-charge?payment=complete`,
    var1: userId,
    var2: String(totalCon),
  });

  try {
    const res = await fetch('https://api.payapp.kr/oapi/apiLoad.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: params.toString(),
    });

    const text = await res.text();
    const parsed = Object.fromEntries(new URLSearchParams(text));

    if (parsed.state !== '1') {
      console.error('[payapp/request] 실패:', text);
      return NextResponse.json({ ok: false, error: parsed.errorMessage || '결제 요청 실패' });
    }

    return NextResponse.json({ ok: true, payurl: parsed.payurl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[payapp/request] 오류:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
