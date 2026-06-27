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
      redirectTarget = `${origin}/auth/complete-profile`;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const isSuperAdmin = user?.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
      const role = user?.user_metadata?.role ?? 'ai_only';

      if (isSuperAdmin) redirectTarget = `${origin}/superadmin`;
      else if (role === 'admin') redirectTarget = `${origin}/admin`;
      else redirectTarget = `${origin}/admin/pdf-editor`;
    }
  }

  const res = NextResponse.redirect(redirectTarget);
  for (const { name, value, options } of pendingCookies) {
    res.cookies.set({ name, value, ...options });
  }
  return res;
}
