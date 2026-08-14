import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const db = createAdminClient();

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL!;
  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const superAdminUser = usersData?.users?.find((u: any) => u.email === superAdminEmail);
  const superAdminId = superAdminUser?.id;

  const allNonAdminUsers = (usersData?.users || []).filter((u: any) => u.id !== superAdminId);
  const totalAcademies = allNonAdminUsers.length;

  // 오늘 날짜 (KST 기준 ISO date)
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayStart = `${todayStr}T00:00:00+09:00`;
  const tomorrowStart = new Date(nowKST);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowStr = tomorrowStart.toISOString().slice(0, 10);
  const tomorrowISO = `${tomorrowStr}T00:00:00+09:00`;

  // 이번 달 1일
  const thisMonthStr = todayStr.slice(0, 7); // YYYY-MM
  const firstOfMonth = `${thisMonthStr}-01T00:00:00+09:00`;

  const [
    studentCountRes,
    smsCountRes,
    topStudentRes,
    todayConRes,
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
    // 오늘의 CON 사용량·충전량
    db
      .from('con_transactions')
      .select('type, amount')
      .gte('created_at', todayStart)
      .lt('created_at', tomorrowISO),
  ]);

  const totalSms = (smsCountRes.data || []).reduce((sum: number, r: any) => sum + (r.total_count || 0), 0);

  // 오늘 방문자: last_sign_in_at이 오늘인 유저 수 (슈퍼어드민 제외)
  const todayVisitors = allNonAdminUsers.filter((u: any) => {
    if (!u.last_sign_in_at) return false;
    return (u.last_sign_in_at as string).startsWith(todayStr);
  }).length;

  // 오늘 CON 사용량·충전량
  let todayConUsage = 0;
  let todayConCharge = 0;
  for (const row of todayConRes.data ?? []) {
    if (row.type === 'charge') todayConCharge += row.amount ?? 0;
    else todayConUsage += row.amount ?? 0;
  }

  // 월별 가입 수 (최근 12개월)
  const monthlyCounts: Record<string, number> = {};
  allNonAdminUsers.forEach((u: any) => {
    const month = (u.created_at as string).slice(0, 7);
    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
  });
  const monthlyData = Object.entries(monthlyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // 주차별 가입 수 (이번 달 기준 4주차)
  const weeklyData = [
    { week: '1주차', count: 0, range: '1~7일' },
    { week: '2주차', count: 0, range: '8~14일' },
    { week: '3주차', count: 0, range: '15~21일' },
    { week: '4주차', count: 0, range: '22일~' },
  ];
  allNonAdminUsers.forEach((u: any) => {
    const created = u.created_at as string;
    if (!created.startsWith(thisMonthStr)) return;
    const day = parseInt(created.slice(8, 10), 10);
    if (day <= 7) weeklyData[0].count++;
    else if (day <= 14) weeklyData[1].count++;
    else if (day <= 21) weeklyData[2].count++;
    else weeklyData[3].count++;
  });

  const thisMonthCount = monthlyCounts[thisMonthStr] || 0;

  // Top5 학원
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
    todayVisitors,
    todayConUsage,
    todayConCharge,
    monthlyData,
    weeklyData,
    top5,
  });
}
