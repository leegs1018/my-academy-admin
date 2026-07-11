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

async function getAlimtalkConfig() {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', ['ALIGO_API_KEY', 'ALIGO_USER_ID', 'KAKAO_SENDER_KEY', 'KAKAO_TEMPLATE_ATTENDANCE_ID', 'KAKAO_TEMPLATE_GRADE_ID']);
  const map: Record<string, string> = {};
  (data ?? []).forEach(row => { if (row.value) map[row.key] = row.value; });
  return {
    apiKey:               map['ALIGO_API_KEY']                 || process.env.ALIGO_API_KEY,
    userId:               map['ALIGO_USER_ID']                 || process.env.ALIGO_USER_ID,
    senderKey:            map['KAKAO_SENDER_KEY']              || process.env.KAKAO_SENDER_KEY,
    attendanceTplCode:    map['KAKAO_TEMPLATE_ATTENDANCE_ID']  || process.env.KAKAO_TEMPLATE_ATTENDANCE_ID,
    gradeTplCode:         map['KAKAO_TEMPLATE_GRADE_ID']       || process.env.KAKAO_TEMPLATE_GRADE_ID,
  };
}

export async function POST(req: Request) {
  const payload = await req.json() as AlimtalkPayload;

  const sender = process.env.SOLAPI_SENDER_NUMBER;
  if (!sender) {
    return NextResponse.json({ ok: false, error: '발신번호 환경변수 누락' }, { status: 500 });
  }

  const cfg = await getAlimtalkConfig();

  if (!cfg.apiKey || !cfg.userId || !cfg.senderKey) {
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

  // 메시지 내용 구성 (템플릿 변수 치환)
  let message = '';
  let subject = '';
  if (payload.type === 'attendance') {
    subject = `[${payload.academyName}] 출결 알림`;
    message = `[${payload.academyName}]\n${payload.studentName} 학생이 ${payload.date} 수업에 ${payload.status}하였습니다.`;
  } else {
    subject = `[${payload.academyName}] 성적 알림`;
    message = payload.content;
  }

  const params = new URLSearchParams();
  params.append('apikey', cfg.apiKey);
  params.append('userid', cfg.userId);
  params.append('senderkey', cfg.senderKey);
  params.append('tpl_code', tplCode);
  params.append('sender', sender.replace(/-/g, ''));
  params.append('receiver_1', payload.to.replace(/-/g, ''));
  params.append('subject_1', subject);
  params.append('message_1', message);

  try {
    const res = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: params.toString(),
    });
    const result = await res.json();
    if (result.code !== 0) {
      return NextResponse.json({ ok: false, error: result.message || `code: ${result.code}` });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
