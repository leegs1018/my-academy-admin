import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { sendAlimtalk } from '@/lib/ppurio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendSMS(to: string, studentName: string, status: string, attendanceDate: string, academyName: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER_NUMBER;

  if (!apiKey || !apiSecret || !sender) {
    return { ok: false, error: 'SOLAPI 환경변수 누락 (SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER_NUMBER)' };
  }

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

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: sender.replace(/-/g, ''), // 혹시 하이픈 포함돼도 제거
          text: `[${academyName}] ${studentName} 학생이 ${displayDate} 수업에 ${status}하였습니다.`,
        },
      }),
    });
    const result = await res.json();
    if (!res.ok) return { ok: false, error: JSON.stringify(result) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
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

  // 학원 알림 방법 조회
  const { data: academyCfg } = await supabaseAdmin
    .from('academy_config')
    .select('notification_method')
    .eq('user_id', academy_id)
    .single();
  const notificationMethod = academyCfg?.notification_method ?? 'sms';

  // 학부모 알림 발송 + CON 차감
  let smsResult: { ok: boolean; error?: string } = { ok: true };
  if (student.parent_phone) {
    const smsMessage = `[${academy_name}] ${student.name} 학생이 ${today.slice(5, 7)}월 ${today.slice(8, 10)}일 수업에 ${action}하였습니다.`;

    if (notificationMethod === 'alimtalk') {
      // 알림톡 발송
      try {
        smsResult = await sendAlimtalk({
          type: 'attendance',
          to: student.parent_phone,
          academyName: academy_name,
          studentName: student.name,
          date: `${today.slice(5, 7)}월 ${today.slice(8, 10)}일`,
          status: action as '등원' | '하원',
        });
      } catch (e: unknown) {
        smsResult = { ok: false, error: e instanceof Error ? e.message : '알림톡 발송 오류' };
      }
    } else {
      // SMS 발송
      const msgType = Buffer.byteLength(smsMessage, 'utf8') > 90 ? 'lms' : 'sms';
      const pricePerMsg = await getFeaturePrice(msgType);
      const balance = await getConBalance(academy_id);
      const canDeduct = balance >= pricePerMsg;

      smsResult = await sendSMS(student.parent_phone, student.name, action, today, academy_name);
      if (!smsResult.ok) console.error('[SMS 실패]', smsResult.error);

      if (smsResult.ok && canDeduct && pricePerMsg > 0) {
        await supabaseAdmin.rpc('deduct_con', {
          p_academy_id: academy_id,
          p_amount: pricePerMsg,
          p_feature_key: 'kiosk',
          p_description: `키오스크 ${msgType.toUpperCase()} 발송 (${student.name} ${action})`,
        });
      }
    }

    // 발송 이력 기록
    await supabaseAdmin.from('sms_logs').insert({
      academy_id,
      message: smsMessage,
      recipient_type: 'kiosk',
      recipients: [{ name: student.name, phone: student.parent_phone }],
      total_count: 1,
      success_count: smsResult.ok ? 1 : 0,
      fail_count: smsResult.ok ? 0 : 1,
    });
  }

  return NextResponse.json({
    success: true,
    message: `${student.name} 학생 ${action} 처리가 완료되었습니다.`,
    student_name: student.name,
    action,
    sms: smsResult.ok ? '발송 완료' : `발송 실패: ${smsResult.error}`,
  });
}
