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
      // "마지막 접속": Auth의 last_sign_in_at(재로그인 시에만 갱신)과 앱 자체 접속
      // 기록(last_active_at, 페이지 이동마다 갱신) 중 더 최근 값을 사용한다 — 세션이
      // 길게 유지되는 사용자(재로그인 없이 계속 사용)의 실제 활동을 놓치지 않기 위함.
      const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
      const lastActive = config.last_active_at ? new Date(config.last_active_at).getTime() : 0;
      const lastActiveAt = Math.max(lastSignIn, lastActive) > 0
        ? new Date(Math.max(lastSignIn, lastActive)).toISOString()
        : null;
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
        last_active_at: lastActiveAt,
        role: u.user_metadata?.role ?? 'ai_only',
        sms_enabled: config.sms_enabled ?? false,
        sms_marketing_agreed: config.sms_marketing_agreed ?? false,
        provider,
        student_count: studentCount[u.id] || 0,
        sms_count: smsCount[u.id] || 0,
        profile_completed: !!configMap[u.id],
      };
    });

  return NextResponse.json({ academies });
}
