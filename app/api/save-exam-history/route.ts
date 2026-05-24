import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

    const { questionPdfPath, answerPdfPath, title, passageExcerpt, passageFull, questionTypes, difficulty } =
      await request.json() as {
        questionPdfPath: string;
        answerPdfPath?: string | null;
        title?: string | null;
        passageExcerpt: string;
        passageFull: string;
        questionTypes: string[];
        difficulty?: string;
      };

    if (!questionPdfPath) {
      return NextResponse.json({ error: 'PDF 경로가 없습니다.' }, { status: 400 });
    }

    const { error: insertErr } = await adminClient.from('exam_question_history').insert({
      academy_id: user.id,
      title: title ?? null,
      passage_excerpt: passageExcerpt,
      passage_full: passageFull,
      question_types: questionTypes,
      question_pdf_path: questionPdfPath,
      answer_pdf_path: answerPdfPath ?? null,
      difficulty: difficulty ?? null,
    });

    if (insertErr) {
      console.error('[save-exam-history] db insert error:', insertErr);
      return NextResponse.json({ error: `DB 저장 실패: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, question_pdf_path: questionPdfPath });
  } catch (error) {
    console.error('[save-exam-history] 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
