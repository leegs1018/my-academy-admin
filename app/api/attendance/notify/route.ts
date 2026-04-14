import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

export async function POST(req: Request) {
  const { to, studentName, status, attendance_date, time, academyName } = await req.json();

  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER_NUMBER;

  // 환경변수 체크
  if (!apiKey || !apiSecret || !sender) {
    return NextResponse.json({ error: '서버 환경변수 설정 오류' }, { status: 500 });
  }

  // 날짜 포맷팅 함수 (YYYY-MM-DD -> MM월 DD일)
  const formatKoreanDate = (dateStr: string) => {
    if (!dateStr) return "";
    const dateObj = new Date(dateStr);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${month}월 ${day}일`;
  };

  const displayDate = formatKoreanDate(attendance_date);

  // 솔라피 인증 헤더 생성
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  const message = {
    message: {
      to: to.replace(/-/g, ''),
      from: sender.replace(/-/g, ''), // 발신번호 하이픈 제거
      text: `[${academyName || '이주영 영어학원'}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`
    }
  };

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: '메시지 발송 서버 에러' }, { status: 500 });
  }
}