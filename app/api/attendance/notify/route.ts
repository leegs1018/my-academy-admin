import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { to, studentName, status, attendance_date, time, academyName, academy_id, notification_method } = await req.json();

  const formatKoreanDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${month}월 ${day}일`;
  };

  const displayDate = formatKoreanDate(attendance_date);

  // notification_method 결정: 파라미터 우선, 없으면 DB 조회
  let method = notification_method ?? 'sms';
  if (!notification_method && academy_id) {
    const { data: cfg } = await supabaseAdmin
      .from('academy_config')
      .select('notification_method')
      .eq('user_id', academy_id)
      .single();
    method = cfg?.notification_method ?? 'sms';
  }

  if (method === 'alimtalk') {
    const pfId = process.env.KAKAO_PF_ID;
    const templateId = process.env.KAKAO_TEMPLATE_ATTENDANCE_ID;
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const sender = process.env.SOLAPI_SENDER_NUMBER;

    if (!pfId || !templateId || !apiKey || !apiSecret || !sender) {
      return NextResponse.json({ ok: false, error: 'ALIMTALK_NOT_CONFIGURED' });
    }

    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2, 12);
    const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
    const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    try {
      const res = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            to: to.replace(/-/g, ''),
            from: sender.replace(/-/g, ''),
            type: 'ATA',
            kakaoOptions: {
              pfId,
              templateId,
              variables: {
                '#{학원명}': academyName || '',
                '#{학생명}': studentName,
                '#{날짜}': displayDate,
                '#{상태}': status,
              },
            },
          },
        }),
      });
      const result = await res.json();
      if (result.errorCode) return NextResponse.json({ ok: false, error: result.errorMessage });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  // SMS 발송
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER_NUMBER;

  if (!apiKey || !apiSecret || !sender) {
    return NextResponse.json({ error: '서버 환경변수 설정 오류' }, { status: 500 });
  }

  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: sender.replace(/-/g, ''),
          text: `[${academyName || '이주영 영어학원'}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`,
        },
      }),
    });
    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: '메시지 발송 서버 에러' }, { status: 500 });
  }
}
