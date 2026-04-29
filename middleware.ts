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

  // 1. 유저 세션 확인 (이 부분이 유저 정보를 서버에서 안전하게 읽어옵니다)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname;

  // 2. 미인증 접근 차단
  if (!user && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (!user && pathname.startsWith('/superadmin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. 일반 학원 원장의 /superadmin 접근 차단
  if (user && pathname.startsWith('/superadmin') && user.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // 4. 로그인 후 리다이렉트 분기 (슈퍼어드민 vs 학원 원장)
  if (user && (pathname === '/login' || pathname === '/register')) {
    const dest = user.email === process.env.SUPER_ADMIN_EMAIL ? '/superadmin' : '/admin'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return response
}

export const config = {
  // 정적 파일(이미지, 아이콘 등)은 검사하지 않도록 설정
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}