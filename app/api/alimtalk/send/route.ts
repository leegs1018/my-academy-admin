import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AttendanceVars {
  type: 'attendance';
  to: string;
  academyName: string;
  studentName: string;
  date: string;
  status: string;
}

interface GradeVars {
  type: 'grade';
  to: string;
  academyName: string;
  studentName: string;
  date: string;
  content: string;
}

type AlimtalkPayload = AttendanceVars | GradeVars;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPpurioConfig() {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', ['PPURIO_API_KEY', 'PPURIO_ACCOUNT', 'KAKAO_SENDER_KEY', 'KAKAO_TEMPLATE_ATTENDANCE_ID', 'KAKAO_TEMPLATE_GRADE_ID']);
  const map: Record<string, string> = {};
  (data ?? []).forEach(row => { if (row.value) map[row.key] = row.value; });
  return {
    apiKey:            map['PPURIO_API_KEY']               || process.env.PPURIO_API_KEY,
    account:           map['PPURIO_ACCOUNT']               || process.env.PPURIO_ACCOUNT,
    senderKey:         map['KAKAO_SENDER_KEY']             || process.env.KAKAO_SENDER_KEY,
    attendanceTplCode: map['KAKAO_TEMPLATE_ATTENDANCE_ID'] || process.env.KAKAO_TEMPLATE_ATTENDANCE_ID,
    gradeTplCode:      map['KAKAO_TEMPLATE_GRADE_ID']      || process.env.KAKAO_TEMPLATE_GRADE_ID,
  };
}

export async function POST(req: Request) {
  const payload = await req.json() as AlimtalkPayload;

  const sender = process.env.PPURIO_SENDER_NUMBER || process.env.SOLAPI_SENDER_NUMBER;
  if (!sender) {
    return NextResponse.json({ ok: false, error: '발신번호 환경변수 누락' }, { status: 500 });
  }

  const cfg = await getPpurioConfig();

  if (!cfg.apiKey || !cfg.account || !cfg.senderKey) {
    return NextResponse.json({
      ok: false,
      error: 'ALIMTALK_NOT_CONFIGURED',
      message: '알림톡 채널이 아직 설정되지 않았습니다. 슈퍼어드민 사이트 설정에서 설정해주세요.',
    }, { status: 503 });
  }

  const tplCode = payload.type === 'attendance' ? cfg.attendanceTplCode : cfg.gradeTplCode;
  if (!tplCode) {
    return NextResponse.json({
      ok: false,
      error: 'ALIMTALK_NOT_CONFIGURED',
      message: '알림톡 템플릿이 설정되지 않았습니다.',
    }, { status: 503 });
  }

  let message = '';
  if (payload.type === 'attendance') {
    message = `[${payload.academyName}]\n${payload.studentName} 학생이 ${payload.date} 수업에 ${payload.status}하였습니다.`;
  } else {
    message = payload.content;
  }

  // 뿌리오 알림톡 REST API
  // 문서: https://www.ppurio.com/api/document/kakao
  const token = Buffer.from(`${cfg.account}:${cfg.apiKey}`).toString('base64');

  try {
    const res = await fetch('https://api.ppurio.com/v1/kakao/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${token}`,
      },
      body: JSON.stringify({
        account:    cfg.account,
        senderKey:  cfg.senderKey,
        tplCode:    tplCode,
        sender:     sender.replace(/-/g, ''),
        receiver:   payload.to.replace(/-/g, ''),
        message,
      }),
    });
    const result = await res.json();
    // 뿌리오 성공 응답: { result_code: '1', ... }
    if (result.result_code !== '1' && result.result_code !== 1) {
      return NextResponse.json({ ok: false, error: result.result_message || `code: ${result.result_code}` });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
