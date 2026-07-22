import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const withdrawn = request.nextUrl.searchParams.get('withdrawn');

  const dest = withdrawn === '1' ? `${origin}/?withdrawn=1` : `${origin}/login`;
  const response = NextResponse.redirect(dest);

  // Supabase 세션 쿠키 직접 삭제 (sb- 로 시작하는 모든 쿠키)
  request.cookies.getAll()
    .filter(c => c.name.startsWith('sb-'))
    .forEach(c => {
      response.cookies.set(c.name, '', { maxAge: 0, path: '/' });
    });

  return response;
}
