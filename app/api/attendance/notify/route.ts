import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { createClient } from '@supabase/supabase-js';
import { sendAlimtalk } from '@/lib/ppurio';

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
  const { to, studentName, status, attendance_date, time, academyName, academy_id, notification_method } = await req.json();

  const displayDate = formatKoreanDate(attendance_date);

  // academy_id가 있으면 항상 DB에서 notification_method 조회
  let method = notification_method ?? 'sms';
  if (academy_id) {
    const { data: cfg } = await supabaseAdmin
      .from('academy_config')
      .select('notification_method')
      .eq('user_id', academy_id)
      .single();
    method = cfg?.notification_method ?? 'sms';
  }

  console.log('[attendance/notify] method:', method);

  if (method === 'alimtalk') {
    try {
      const result = await sendAlimtalk({
        type: 'attendance',
        to,
        academyName: academyName || '',
        studentName,
        date: displayDate,
        status: status as '등원' | '하원',
      });
      console.log('[attendance/notify] 알림톡 결과:', JSON.stringify(result));
      return NextResponse.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알림톡 발송 오류';
      console.error('[attendance/notify] 오류:', msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // SMS 발송 (솔라피)
  const apiKey    = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender    = process.env.SOLAPI_SENDER_NUMBER;

  if (!apiKey || !apiSecret || !sender) {
    return NextResponse.json({ error: '서버 환경변수 설정 오류' }, { status: 500 });
  }

  const date      = new Date().toISOString();
  const salt      = Math.random().toString(36).substring(2, 12);
  const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          to:   to.replace(/-/g, ''),
          from: sender.replace(/-/g, ''),
          text: `[${academyName || '학원'}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`,
        },
      }),
    });
    const result = await res.json();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: '메시지 발송 서버 에러' }, { status: 500 });
  }
}
