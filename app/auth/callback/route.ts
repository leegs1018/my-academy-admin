import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = (searchParams.get('type') as EmailOtpType) ?? 'magiclink';

  // 쿠키를 나중에 응답에 적용하기 위해 수집
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          pendingCookies.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          pendingCookies.push({ name, value: '', options });
        },
      },
    }
  );

  let userId: string | null = null;

  if (code) {
    // Google, Kakao OAuth 플로우
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.session?.user?.id ?? null;
  } else if (token_hash) {
    // Naver magic link 플로우
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) userId = data.session?.user?.id ?? null;
  }

  let redirectTarget: string;

  if (!userId) {
    redirectTarget = `${origin}/login?error=auth_failed`;
  } else {
    // academy_config 존재 여부로 신규/기존 사용자 구분
    const admin = createAdminClient();
    const { data: config } = await admin
      .from('academy_config')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!config) {
      // 소셜 로그인: academy_config 즉시 생성 후 admin 대시보드로 이동
      const RANDOM_NAMES = ['오리온','페가수스','시리우스','카시오페이아','안드로메다','처녀자리','사자자리','전갈자리','쌍둥이자리','독수리자리','백조자리','큰곰자리','에리다누스','켄타우루스','에메랄드','사파이어','루비','오팔','토파즈','아폴로','아테나','헤르메스','아르테미스','포세이돈','북극성','은하수','금성','새벽별','달빛','유성'];
      const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] + '_' + (Math.floor(Math.random() * 900) + 100);
      const kioskCode = Math.floor(100000 + Math.random() * 900000).toString();
      const ownReferralCode = Math.random().toString(36).slice(2, 10).toUpperCase();
      const BASE_BONUS = 100;

      await admin.from('academy_config').insert({
        user_id: userId,
        academy_name: randomName,
        points: BASE_BONUS,
        kiosk_code: kioskCode,
        own_referral_code: ownReferralCode,
      });

      // user_metadata.role 을 'admin'으로 설정 — 기존 필드 보존 후 merge
      const { data: { user: newUser } } = await admin.auth.admin.getUserById(userId);
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { ...(newUser?.user_metadata ?? {}), role: 'admin' },
      });

      // 가입 보너스 CON 이력 기록
      await admin.from('con_transactions').insert({
        academy_id: userId,
        type: 'charge',
        amount: BASE_BONUS,
        balance_after: BASE_BONUS,
        feature_key: 'signup_bonus',
        description: '신규 가입 보너스',
      });

      redirectTarget = `${origin}/auth/agree-terms`;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const isSuperAdmin = user?.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;

      // user_metadata.role 미설정 시 'admin'으로 보정 — 기존 필드 보존 후 merge
      if (user && !user.user_metadata?.role) {
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: { ...(user.user_metadata ?? {}), role: 'admin' },
        });
      }

      if (isSuperAdmin) redirectTarget = `${origin}/superadmin`;
      else redirectTarget = `${origin}/admin`;
    }
  }

  const res = NextResponse.redirect(redirectTarget);
  for (const { name, value, options } of pendingCookies) {
    res.cookies.set({ name, value, ...options });
  }
  return res;
}
