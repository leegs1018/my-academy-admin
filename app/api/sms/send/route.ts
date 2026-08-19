import { NextResponse } from 'next/server';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendPpurioSms } from '@/lib/ppurio';

interface Recipient {
  student_id: string;
  name: string;
  phone: string;
}

export async function POST(req: Request) {
  try {
    const { message, recipients, academy_id } = await req.json() as {
      message: string;
      recipients: Recipient[];
      academy_id?: string;
    };

    if (!message || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: '메시지와 수신자를 입력해주세요.' }, { status: 400 });
    }

    // SMS / LMS 자동 구분 (90바이트 초과 시 LMS)
    const byteLength = Buffer.byteLength(message, 'utf8');
    const messageType = byteLength > 90 ? 'lms' : 'sms';

    // LMS 발송 시 학원명을 제목으로 사용
    let lmsSubject: string | undefined;
    if (messageType === 'lms' && academy_id) {
      const supabaseAdmin = createAdminClient();
      const { data: cfg } = await supabaseAdmin
        .from('academy_config')
        .select('academy_name')
        .eq('user_id', academy_id)
        .single();
      if (cfg?.academy_name) lmsSubject = `[${cfg.academy_name}]`;
    }

    // CON 잔액 확인 및 차감
    if (academy_id) {
      const pricePerMsg = await getFeaturePrice(messageType);
      const totalCost = pricePerMsg * recipients.length;

      if (totalCost > 0) {
        const balance = await getConBalance(academy_id);
        if (balance < totalCost) {
          return NextResponse.json({
            error: 'INSUFFICIENT_CON',
            required: totalCost,
            balance,
            price_per_sms: pricePerMsg,
            message_type: messageType,
          }, { status: 402 });
        }

        const supabaseAdmin = createAdminClient();
        const { error: deductError } = await supabaseAdmin.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: totalCost,
          p_feature_key: messageType,
          p_description: `${messageType.toUpperCase()} 발송 ${recipients.length}건 × ${pricePerMsg}C`,
        });

        if (deductError) {
          console.error('[sms/send] deduct_con 오류:', deductError.message);
          if (deductError.message?.includes('INSUFFICIENT_CON')) {
            return NextResponse.json({ error: 'INSUFFICIENT_CON', required: totalCost, balance }, { status: 402 });
          }
          return NextResponse.json({ error: `CON 차감 오류: ${deductError.message}` }, { status: 500 });
        }
      }
    }

    const results: { student_id: string; name: string; phone: string; status: 'success' | 'fail'; error?: string }[] = [];

    for (const recipient of recipients) {
      const result = await sendPpurioSms(recipient.phone, message, academy_id, lmsSubject);
      if (result.ok) {
        results.push({ student_id: recipient.student_id, name: recipient.name, phone: recipient.phone, status: 'success' });
      } else {
        results.push({ student_id: recipient.student_id, name: recipient.name, phone: recipient.phone, status: 'fail', error: result.error });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    return NextResponse.json({ total: results.length, success: successCount, fail: failCount, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[sms/send] 오류:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
