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

  // 2. 로그인 안 된 상태에서 /admin 접근 시 로그인 페이지로
  if (!user && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

// 3. 이미 로그인 된 상태에서 로그인/회원가입 접근 시 /admin으로 보냄
if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
  return NextResponse.redirect(new URL('/admin', request.url)) // 여기를 /admin으로 변경!
}

  return response
}

export const config = {
  // 정적 파일(이미지, 아이콘 등)은 검사하지 않도록 설정
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}