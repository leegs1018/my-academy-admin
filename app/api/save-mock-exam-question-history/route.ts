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

    const { questionPdfPath, answerPdfPath, year, grade, institution, questionNumbers, questionTypes, difficulty } =
      await request.json() as {
        questionPdfPath: string;
        answerPdfPath?: string | null;
        year: number;
        grade: string;
        institution: string;
        questionNumbers: number[];
        questionTypes: string[];
        difficulty?: string;
      };

    const { error: insertErr } = await adminClient.from('mock_exam_question_history').insert({
      academy_id: user.id,
      year,
      grade,
      institution,
      question_numbers: questionNumbers,
      question_types: questionTypes,
      difficulty: difficulty ?? null,
      question_pdf_path: questionPdfPath,
      answer_pdf_path: answerPdfPath ?? null,
    });

    if (insertErr) return NextResponse.json({ error: `DB 저장 실패: ${insertErr.message}` }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[save-mock-exam-question-history] 오류:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, { status: 500 });
  }
}
