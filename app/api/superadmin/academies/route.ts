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

  const academiesRes = await db.from('academy_config').select('*');
  const configMap: Record<string, any> = {};
  (academiesRes.data || []).forEach((a: any) => { configMap[a.user_id] = a; });

  const studentCount: Record<string, number> = {};
  (studentsRes.data || []).forEach((r: any) => {
    studentCount[r.academy_id] = (studentCount[r.academy_id] || 0) + 1;
  });

  const smsCount: Record<string, number> = {};
  (smsRes.data || []).forEach((r: any) => {
    smsCount[r.academy_id] = (smsCount[r.academy_id] || 0) + (r.total_count || 0);
  });

  const SNS = ['google', 'kakao', 'naver'];

  // auth.users 기준으로 전체 목록 생성 (academy_config 미완성 유저도 포함)
  const academies = allUsers
    .filter((u: any) => u.id !== superAdminId)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((u: any) => {
      const config = configMap[u.id] ?? {};
      const snsIdentity = (u.identities ?? []).find((i: { provider: string }) => SNS.includes(i.provider));
      const provider = u.user_metadata?.provider || snsIdentity?.provider || u.app_metadata?.provider || 'email';
      return {
        user_id: u.id,
        academy_name: config.academy_name || '',
        email: u.email || '',
        academy_phone: config.academy_phone || '',
        mobile: config.mobile || '',
        points: config.points || 0,
        kiosk_code: config.kiosk_code || '',
        referral_code: config.referral_code || '',
        own_referral_code: config.own_referral_code || null,
        created_at: u.created_at,
        role: u.user_metadata?.role ?? 'ai_only',
        provider,
        student_count: studentCount[u.id] || 0,
        sms_count: smsCount[u.id] || 0,
        profile_completed: !!configMap[u.id],
      };
    });

  return NextResponse.json({ academies });
}
