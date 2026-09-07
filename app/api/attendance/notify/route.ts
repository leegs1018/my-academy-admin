import { NextResponse } from 'next/server';
import { sendAlimtalk, sendPpurioSms } from '@/lib/ppurio';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatKoreanDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
}

export async function POST(req: Request) {
  const { to, studentName, status, attendance_date, academyName, academy_id, notification_method } = await req.json();

  const displayDate = formatKoreanDate(attendance_date);

  let method = notification_method ?? 'sms';
  if (academy_id) {
    const { data: cfg } = await supabaseAdmin
      .from('academy_config')
      .select('notification_method')
      .eq('user_id', academy_id)
      .single();
    method = (cfg?.notification_method ?? 'sms').trim();
  }

  if (method === 'alimtalk') {
    try {
      const result = await sendAlimtalk({
        type: 'attendance',
        to,
        academyName: academyName || '',
        studentName,
        date: displayDate,
        status: status as '등원' | '하원',
      }, academy_id);
      console.log('[attendance/notify] 알림톡 결과:', JSON.stringify(result));

      // 알림톡 발송 이력 기록 (CON 차감은 alimtalk/send에서 처리)
      if (academy_id) {
        await supabaseAdmin.from('sms_logs').insert({
          academy_id,
          message: `[알림톡] ${academyName} ${studentName} ${status} (${displayDate})`,
          recipient_type: 'parent',
          recipients: [{ name: studentName, phone: to, status: result.ok ? 'success' : 'fail', error: result.error }],
          total_count: 1,
          success_count: result.ok ? 1 : 0,
          fail_count: result.ok ? 0 : 1,
        });
      }

      return NextResponse.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알림톡 발송 오류';
      console.error('[attendance/notify] 오류:', msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // SMS 발송 (Ppurio)
  const smsText = `[${academyName || '학원'}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`;
  const msgType = Buffer.byteLength(smsText, 'utf8') > 90 ? 'lms' : 'sms';

  try {
    // CON 차감
    if (academy_id) {
      const pricePerMsg = await getFeaturePrice(msgType);
      if (pricePerMsg > 0) {
        const balance = await getConBalance(academy_id);
        if (balance >= pricePerMsg) {
          const db = createAdminClient();
          await db.rpc('deduct_con', {
            p_academy_id: academy_id,
            p_amount: pricePerMsg,
            p_feature_key: msgType,
            p_description: `출결 ${msgType.toUpperCase()} 발송 (${studentName} ${status})`,
          });
        }
      }
    }

    const result = await sendPpurioSms(to, smsText, academy_id);
    console.log('[attendance/notify] SMS 결과:', JSON.stringify(result));

    // 발송 이력 기록
    if (academy_id) {
      await supabaseAdmin.from('sms_logs').insert({
        academy_id,
        message: smsText,
        recipient_type: 'parent',
        recipients: [{ name: studentName, phone: to, status: result.ok ? 'success' : 'fail', error: result.error }],
        total_count: 1,
        success_count: result.ok ? 1 : 0,
        fail_count: result.ok ? 0 : 1,
      });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'SMS 발송 오류';
    console.error('[attendance/notify] SMS 오류:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
