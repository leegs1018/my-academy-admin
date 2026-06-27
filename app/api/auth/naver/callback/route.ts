import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

interface NaverTokenResponse {
  access_token?: string;
  error?: string;
}

interface NaverProfileResponse {
  response?: {
    email?: string;
    name?: string;
    nickname?: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=naver_failed`);
  }

  const redirectUri = `${origin}/api/auth/naver/callback`;

  // 1. 코드 → 액세스 토큰 교환
  const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NAVER_CLIENT_ID!,
      client_secret: process.env.NAVER_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
      state: searchParams.get('state') ?? '',
    }),
  });

  const tokenData = (await tokenRes.json()) as NaverTokenResponse;
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${origin}/login?error=naver_failed`);
  }

  // 2. 네이버 사용자 정보 조회
  const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profileData = (await profileRes.json()) as NaverProfileResponse;
  const email = profileData.response?.email;
  const fullName = profileData.response?.name ?? profileData.response?.nickname ?? '';

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=naver_no_email`);
  }

  const admin = createAdminClient();

  // 3. Supabase 유저 생성 (이미 존재하면 무시)
  await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, provider: 'naver', role: 'ai_only' },
  });

  // 4. 로그인용 magic link 생성
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.redirect(`${origin}/login?error=naver_failed`);
  }

  // action_link를 거치지 않고 token_hash를 직접 auth/callback에 전달
  const hashedToken = linkData.properties.hashed_token;
  return NextResponse.redirect(
    `${origin}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`
  );
}
