import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function sendSMS(to: string, studentName: string, status: string, attendanceDate: string, academyName: string) {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER_NUMBER;

  if (!apiKey || !apiSecret || !sender) return;

  const formatKoreanDate = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${month}월 ${day}일`;
  };

  const displayDate = formatKoreanDate(attendanceDate);
  const date = new Date().toISOString();
  const salt = Math.random().toString(36).substring(2, 12);
  const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

  await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        to: to.replace(/-/g, ''),
        from: sender,
        text: `[${academyName}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`,
      },
    }),
  });
}

export async function POST(req: Request) {
  const { academy_id, student_id, action, academy_name } = await req.json();

  if (!academy_id || !student_id || !action || !academy_name) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (action !== '등원' && action !== '하원') {
    return NextResponse.json({ error: '유효하지 않은 출결 유형입니다.' }, { status: 400 });
  }

  // 학생 정보 조회 + 테넌트 검증
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, class_name, parent_phone, academy_id')
    .eq('id', student_id)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (student.academy_id !== academy_id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  // 오늘 날짜 (KST)
  const today = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '-').replace('.', '');

  // 오늘 기존 출석 기록 조회
  const { data: existing } = await supabase
    .from('attendance')
    .select('id, status, created_at, updated_at')
    .eq('academy_id', academy_id)
    .eq('student_id', student_id)
    .eq('attendance_date', today)
    .single();

  // 5분 중복 방지 체크
  if (existing) {
    const lastActionAt = existing.updated_at ?? existing.created_at;
    if (lastActionAt) {
      const diffMs = Date.now() - new Date(lastActionAt).getTime();
      if (diffMs < 5 * 60 * 1000 && existing.status === action) {
        return NextResponse.json({
          error: `이미 ${action} 처리되었습니다. 5분 후 다시 시도해주세요.`,
          duplicate: true,
        }, { status: 409 });
      }
    }
  }

  // 유효성 검사: 하원은 등원 기록이 있어야 함
  if (action === '하원' && (!existing || existing.status === '하원')) {
    return NextResponse.json({
      error: '먼저 등원 처리가 필요합니다.',
    }, { status: 400 });
  }

  // 이미 하원 완료 시 등원 불가
  if (action === '등원' && existing && existing.status === '하원') {
    return NextResponse.json({
      error: '오늘 이미 하원 처리가 완료되었습니다.',
    }, { status: 400 });
  }

  // 출석 기록 upsert
  const { error: upsertError } = await supabase
    .from('attendance')
    .upsert(
      {
        academy_id,
        student_id,
        student_name: student.name,
        class_name: student.class_name,
        status: action,
        attendance_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,attendance_date' }
    );

  if (upsertError) {
    return NextResponse.json({ error: '출결 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 학부모 SMS 발송
  if (student.parent_phone) {
    await sendSMS(student.parent_phone, student.name, action, today, academy_name);
  }

  return NextResponse.json({
    success: true,
    message: `${student.name} 학생 ${action} 처리가 완료되었습니다.`,
    student_name: student.name,
    action,
  });
}
