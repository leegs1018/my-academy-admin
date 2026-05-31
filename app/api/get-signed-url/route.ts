import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
    }

    const { path } = await request.json() as { path: string };
    if (!path) {
      return NextResponse.json({ error: '파일 경로가 없습니다.' }, { status: 400 });
    }

    // 본인 파일만 접근 허용 (exam/{id}/ 또는 {id}/ 로 시작해야 함)
    const validPrefixes = [`exam/${user.id}/`, `${user.id}/`];
    if (!validPrefixes.some(prefix => path.startsWith(prefix))) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { data, error } = await adminClient.storage
      .from('pdf-history')
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      console.error('[get-signed-url] 오류:', error);
      return NextResponse.json({ error: '다운로드 링크 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('[get-signed-url] 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
