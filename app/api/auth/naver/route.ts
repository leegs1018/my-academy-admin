import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/naver/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.NAVER_CLIENT_ID!,
    redirect_uri: redirectUri,
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(
    `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`
  );
}
