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

  const [
    academyCountRes,
    studentCountRes,
    smsCountRes,
    monthlyRes,
    topStudentRes,
  ] = await Promise.all([
    superAdminId
      ? db.from('academy_config').select('*', { count: 'exact', head: true }).neq('user_id', superAdminId)
      : db.from('academy_config').select('*', { count: 'exact', head: true }),
    superAdminId
      ? db.from('students').select('*', { count: 'exact', head: true }).neq('academy_id', superAdminId)
      : db.from('students').select('*', { count: 'exact', head: true }),
    superAdminId
      ? db.from('sms_logs').select('total_count').neq('academy_id', superAdminId)
      : db.from('sms_logs').select('total_count'),
    superAdminId
      ? db.from('academy_config').select('created_at').neq('user_id', superAdminId).order('created_at', { ascending: false })
      : db.from('academy_config').select('created_at').order('created_at', { ascending: false }),
    superAdminId
      ? db.from('students').select('academy_id').neq('academy_id', superAdminId)
      : db.from('students').select('academy_id'),
  ]);

  const totalSms = (smsCountRes.data || []).reduce((sum: number, r: any) => sum + (r.total_count || 0), 0);

  // 월별 가입 수 계산
  const monthlyCounts: Record<string, number> = {};
  (monthlyRes.data || []).forEach((r: any) => {
    const month = r.created_at.slice(0, 7);
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
    totalAcademies: academyCountRes.count || 0,
    totalStudents: studentCountRes.count || 0,
    totalSms,
    thisMonthNewAcademies: thisMonthCount,
    monthlyData,
    top5,
  });
}
