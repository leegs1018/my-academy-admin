import { NextResponse } from 'next/server';
import { sendAlimtalk, AlimtalkPayload } from '@/lib/ppurio';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const { academy_id, ...payload } = await req.json() as AlimtalkPayload & { academy_id?: string };

  // CON 잔액 확인 및 차감
  if (academy_id) {
    const price = await getFeaturePrice('alimtalk');
    if (price > 0) {
      const balance = await getConBalance(academy_id);
      if (balance < price) {
        return NextResponse.json({ ok: false, error: 'INSUFFICIENT_CON', required: price, balance }, { status: 402 });
      }
      const db = createAdminClient();
      const { error: deductError } = await db.rpc('deduct_con', {
        p_academy_id: academy_id,
        p_amount: price,
        p_feature_key: 'alimtalk',
        p_description: `알림톡 발송 (${payload.type === 'grade' ? '성적' : '출결'} · ${(payload as any).studentName ?? ''})`,
      });
      if (deductError) {
        console.error('[alimtalk/send] CON 차감 오류:', deductError.message);
      }
    }
  }

  try {
    const result = await sendAlimtalk(payload, academy_id);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[alimtalk/send] 오류:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
