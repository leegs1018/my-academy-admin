import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(_name: string, _value: string, _options: CookieOptions) {},
          remove(_name: string, _options: CookieOptions) {},
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { ids } = await request.json() as { ids: string[] };
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 항목이 없습니다.' }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch items to get pdf_paths (also verifies ownership)
    const { data: items, error: fetchErr } = await adminClient
      .from('pdf_history')
      .select('id, pdf_path')
      .in('id', ids)
      .eq('academy_id', user.id);

    if (fetchErr) {
      return NextResponse.json({ error: `조회 실패: ${fetchErr.message}` }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '삭제할 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const paths = items.filter(i => i.pdf_path).map(i => i.pdf_path as string);
    if (paths.length > 0) {
      await adminClient.storage.from('pdf-history').remove(paths);
    }

    const verifiedIds = items.map(i => i.id);
    const { error: delErr } = await adminClient
      .from('pdf_history')
      .delete()
      .in('id', verifiedIds);

    if (delErr) {
      return NextResponse.json({ error: `삭제 실패: ${delErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: verifiedIds.length });
  } catch (error) {
    console.error('[delete-pdf-history] 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
