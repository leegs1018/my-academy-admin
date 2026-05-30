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
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });

    const { ids } = await request.json() as { ids: string[] };
    if (!ids || ids.length === 0) return NextResponse.json({ error: '삭제할 항목이 없습니다.' }, { status: 400 });

    const { data: items, error: fetchErr } = await adminClient
      .from('mock_exam_question_history').select('id, question_pdf_path, answer_pdf_path')
      .in('id', ids).eq('academy_id', user.id);
    if (fetchErr) return NextResponse.json({ error: `조회 실패: ${fetchErr.message}` }, { status: 500 });
    if (!items || items.length === 0) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });

    const paths = items.flatMap(i => [i.question_pdf_path, i.answer_pdf_path].filter(Boolean) as string[]);
    if (paths.length > 0) await adminClient.storage.from('pdf-history').remove(paths);

    const { error: delErr } = await adminClient.from('mock_exam_question_history').delete().in('id', items.map(i => i.id));
    if (delErr) return NextResponse.json({ error: `삭제 실패: ${delErr.message}` }, { status: 500 });

    return NextResponse.json({ success: true, deleted: items.length });
  } catch (error) {
    console.error('[delete-mock-exam-question-history] 오류:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, { status: 500 });
  }
}
