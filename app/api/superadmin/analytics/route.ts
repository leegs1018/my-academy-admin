import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const db = createAdminClient();

  // 슈퍼어드민 user_id 조회 (통계에서 제외하기 위해)
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL!;
  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const superAdminUser = usersData?.users?.find((u: any) => u.email === superAdminEmail);
  const superAdminId = superAdminUser?.id;

  // auth.users 기준 전체 유저 목록 (슈퍼어드민 제외) — 프로필 미완성 포함
  const allNonAdminUsers = (usersData?.users || []).filter((u: any) => u.id !== superAdminId);
  const totalAcademies = allNonAdminUsers.length;

  const [
    studentCountRes,
    smsCountRes,
    topStudentRes,
  ] = await Promise.all([
    superAdminId
      ? db.from('students').select('*', { count: 'exact', head: true }).neq('academy_id', superAdminId)
      : db.from('students').select('*', { count: 'exact', head: true }),
    superAdminId
      ? db.from('sms_logs').select('total_count').neq('academy_id', superAdminId)
      : db.from('sms_logs').select('total_count'),
    superAdminId
      ? db.from('students').select('academy_id').neq('academy_id', superAdminId)
      : db.from('students').select('academy_id'),
  ]);

  const totalSms = (smsCountRes.data || []).reduce((sum: number, r: any) => sum + (r.total_count || 0), 0);

  // 월별 가입 수 계산 (auth.users.created_at 기준, 프로필 미완성 포함)
  const monthlyCounts: Record<string, number> = {};
  allNonAdminUsers.forEach((u: any) => {
    const month = (u.created_at as string).slice(0, 7);
    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
  });
  const monthlyData = Object.entries(monthlyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = monthlyCounts[thisMonth] || 0;

  // Top5 학원 (학생 수 기준)
  const studentsByAcademy: Record<string, number> = {};
  (topStudentRes.data || []).forEach((r: any) => {
    studentsByAcademy[r.academy_id] = (studentsByAcademy[r.academy_id] || 0) + 1;
  });
  const top5Ids = Object.entries(studentsByAcademy)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let top5Query = db.from('academy_config').select('user_id, academy_name');
  if (top5Ids.length > 0) top5Query = top5Query.in('user_id', top5Ids);
  const top5Res = top5Ids.length > 0 ? await top5Query : { data: [] };

  const top5 = top5Ids.map(id => ({
    academy_id: id,
    academy_name: (top5Res.data || []).find((a: any) => a.user_id === id)?.academy_name || '(이름 없음)',
    student_count: studentsByAcademy[id],
  }));

  return NextResponse.json({
    totalAcademies,
    totalStudents: studentCountRes.count || 0,
    totalSms,
    thisMonthNewAcademies: thisMonthCount,
    monthlyData,
    top5,
  });
}
