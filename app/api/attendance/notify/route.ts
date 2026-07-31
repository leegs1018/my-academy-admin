import { NextResponse } from 'next/server';
import { sendAlimtalk, sendPpurioSms } from '@/lib/ppurio';
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
      return NextResponse.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알림톡 발송 오류';
      console.error('[attendance/notify] 오류:', msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // SMS 발송 (Ppurio)
  const smsText = `[${academyName || '학원'}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`;
  try {
    const result = await sendPpurioSms(to, smsText, academy_id);
    console.log('[attendance/notify] SMS 결과:', JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'SMS 발송 오류';
    console.error('[attendance/notify] SMS 오류:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
