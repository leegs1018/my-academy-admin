import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const db = createAdminClient();

  // 슈퍼어드민 user_id 조회 (목록에서 제외)
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL!;
  const [usersRes, studentsRes, smsRes] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from('students').select('academy_id'),
    db.from('sms_logs').select('academy_id, total_count'),
  ]);

  const allUsers = usersRes.data?.users || [];
  const superAdminUser = allUsers.find((u: any) => u.email === superAdminEmail);
  const superAdminId = superAdminUser?.id;

  const academiesQuery = db.from('academy_config').select('*').order('created_at', { ascending: false });
  const academiesRes = superAdminId
    ? await academiesQuery.neq('user_id', superAdminId)
    : await academiesQuery;

  const emailMap: Record<string, string> = {};
  const roleMap: Record<string, string> = {};
  const providerMap: Record<string, string> = {};
  allUsers.forEach((u: any) => {
    emailMap[u.id] = u.email || '';
    roleMap[u.id] = u.user_metadata?.role ?? 'ai_only';
    // Naver는 user_metadata.provider에 수동 저장, Google/Kakao는 app_metadata.provider에 자동 저장
    providerMap[u.id] = u.user_metadata?.provider || u.app_metadata?.provider || 'email';
  });

  const studentCount: Record<string, number> = {};
  (studentsRes.data || []).forEach((r: any) => {
    studentCount[r.academy_id] = (studentCount[r.academy_id] || 0) + 1;
  });

  const smsCount: Record<string, number> = {};
  (smsRes.data || []).forEach((r: any) => {
    smsCount[r.academy_id] = (smsCount[r.academy_id] || 0) + (r.total_count || 0);
  });

  const academies = (academiesRes.data || []).map((a: any) => ({
    ...a,
    email: emailMap[a.user_id] || '',
    role: roleMap[a.user_id] ?? 'ai_only',
    provider: providerMap[a.user_id] ?? 'email',
    student_count: studentCount[a.user_id] || 0,
    sms_count: smsCount[a.user_id] || 0,
  }));

  return NextResponse.json({ academies });
}
