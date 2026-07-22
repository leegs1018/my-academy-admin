import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const withdrawn = new URL(request.url).searchParams.get('withdrawn');

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // 서버사이드에서 세션 쿠키 삭제 (유저가 이미 삭제되어 에러가 나도 쿠키는 지워짐)
  await supabase.auth.signOut().catch(() => {});

  const dest = withdrawn === '1' ? `${origin}/?withdrawn=1` : `${origin}/login`;
  return NextResponse.redirect(dest);
}
