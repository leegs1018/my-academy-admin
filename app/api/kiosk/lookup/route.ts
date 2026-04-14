import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { academy_id, phone_last4 } = await req.json();

  if (!academy_id || !phone_last4 || phone_last4.length !== 4) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  // 학생 조회 (휴원/퇴원 제외, 핸드폰 뒷자리 매칭)
  const { data: allStudents, error: studentError } = await supabase
    .from('students')
    .select('id, name, class_name, student_phone, status')
    .eq('academy_id', academy_id)
    .not('status', 'in', '("휴원","퇴원")');

  if (studentError) {
    return NextResponse.json({ error: `학생 조회 오류: ${studentError.message}` }, { status: 500 });
  }

  if (!allStudents || allStudents.length === 0) {
    return NextResponse.json({ error: '이 학원에 등록된 학생이 없습니다.' }, { status: 404 });
  }

  // 핸드폰 뒷자리 매칭 (하이픈 제거 후 비교)
  const students = allStudents.filter((s) => {
    if (!s.student_phone) return false;
    const normalized = s.student_phone.replace(/-/g, '');
    return normalized.endsWith(phone_last4);
  });

  if (students.length === 0) {
    return NextResponse.json({ error: '해당 번호로 등록된 학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 오늘 날짜 (KST 기준)
  const today = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '-').replace('.', '');

  const studentIds = students.map((s) => s.id);

  // 오늘 출석 기록 조회
  const { data: attendances } = await supabase
    .from('attendance')
    .select('student_id, status, updated_at, created_at')
    .eq('academy_id', academy_id)
    .eq('attendance_date', today)
    .in('student_id', studentIds);

  const attendanceMap = new Map(attendances?.map((a) => [a.student_id, a]) ?? []);

  const result = students.map((student) => {
    const att = attendanceMap.get(student.id);
    return {
      id: student.id,
      name: student.name,
      class_name: student.class_name,
      today_status: att?.status ?? '없음',
      last_action_at: att?.updated_at ?? att?.created_at ?? null,
    };
  });

  return NextResponse.json({ students: result });
}
