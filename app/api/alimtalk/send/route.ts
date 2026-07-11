import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

// 알림톡 템플릿 변수 타입
interface AttendanceVars {
  type: 'attendance';
  to: string;
  academyName: string;
  studentName: string;
  date: string;     // "07월 11일"
  status: string;   // "등원" | "하원"
}

interface GradeVars {
  type: 'grade';
  to: string;
  academyName: string;
  studentName: string;
  date: string;     // "7월 11일(금)"
  content: string;  // 성적 내용 전체
}

type AlimtalkPayload = AttendanceVars | GradeVars;

function buildSolapiAuth(apiSecret: string) {
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function POST(req: Request) {
  const payload = await req.json() as AlimtalkPayload;

  const apiKey    = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender    = process.env.SOLAPI_SENDER_NUMBER;
  const pfId      = process.env.KAKAO_PF_ID;

  const templateId =
    payload.type === 'attendance'
      ? process.env.KAKAO_TEMPLATE_ATTENDANCE_ID
      : process.env.KAKAO_TEMPLATE_GRADE_ID;

  if (!apiKey || !apiSecret || !sender) {
    return NextResponse.json({ ok: false, error: 'SOLAPI 환경변수 누락' }, { status: 500 });
  }

  if (!pfId || !templateId) {
    return NextResponse.json({
      ok: false,
      error: 'ALIMTALK_NOT_CONFIGURED',
      message: '알림톡 채널이 아직 설정되지 않았습니다. 카카오 채널 승인 후 이용 가능합니다.',
    }, { status: 503 });
  }

  // 템플릿 변수 구성
  let variables: Record<string, string> = {};
  if (payload.type === 'attendance') {
    variables = {
      '#{학원명}': payload.academyName,
      '#{학생명}': payload.studentName,
      '#{날짜}': payload.date,
      '#{상태}': payload.status,
    };
  } else {
    variables = {
      '#{학원명}': payload.academyName,
      '#{학생명}': payload.studentName,
      '#{날짜}': payload.date,
      '#{성적내용}': payload.content,
    };
  }

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        Authorization: buildSolapiAuth(apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: payload.to.replace(/-/g, ''),
          from: sender.replace(/-/g, ''),
          type: 'ATA',
          kakaoOptions: { pfId, templateId, variables },
        },
      }),
    });

    const result = await res.json();
    if (result.errorCode) {
      return NextResponse.json({ ok: false, error: result.errorMessage || result.errorCode });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
