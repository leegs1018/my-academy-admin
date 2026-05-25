import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // 이 부분이 핵심! request와 response 양쪽에 쿠키를 심어줍니다.
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // 삭제할 때는 value를 빈 값으로 넘겨주면 됩니다.
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 1. 유저 세션 확인
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname;
  const isSuperAdmin = user?.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
  const role = user?.user_metadata?.role ?? 'ai_only';

  // 2. 미인증 접근 차단
  if (!user && (pathname.startsWith('/admin') || pathname.startsWith('/tool'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (!user && pathname.startsWith('/superadmin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. 권한 초과 접근 차단
  // 일반 사용자의 /superadmin 접근 차단
  if (user && pathname.startsWith('/superadmin') && !isSuperAdmin) {
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/admin/pdf-editor', request.url))
  }

  // ai_only 사용자는 AI 도구 경로 외 /admin 접근 차단
  const aiAllowed = ['/admin/pdf-editor', '/admin/ai-questions', '/admin/mock-exam-questions'];
  if (user && pathname.startsWith('/admin') && role === 'ai_only' && !isSuperAdmin &&
      !aiAllowed.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/admin/pdf-editor', request.url))
  }

  // 4. 로그인 후 리다이렉트 분기
  if (user && (pathname === '/login' || pathname === '/register')) {
    let dest = '/admin/pdf-editor';
    if (isSuperAdmin) dest = '/superadmin';
    else if (role === 'admin') dest = '/admin';
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // /tool 접근 시 ai_only → pdf-editor, admin → /admin 으로 이동
  if (user && pathname === '/tool') {
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/admin/pdf-editor', request.url))
  }

  return response
}

export const config = {
  // 정적 파일(이미지, 아이콘 등)은 검사하지 않도록 설정
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}