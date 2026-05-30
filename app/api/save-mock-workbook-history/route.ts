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
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });

    const { pdfBase64, answerPdfBase64, year, grade, institution, questionNumber, difficulty } =
      await request.json() as {
        pdfBase64: string;
        answerPdfBase64?: string;
        year: number;
        grade: string;
        institution: string;
        questionNumber: number;
        difficulty: string;
      };

    if (!pdfBase64) return NextResponse.json({ error: 'PDF 데이터가 없습니다.' }, { status: 400 });

    const ts = Date.now();
    const fileName = `mock-workbook/${user.id}/${ts}.pdf`;
    const answerFileName = answerPdfBase64 ? `mock-workbook/${user.id}/${ts}_answer.pdf` : null;

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const { error: uploadErr } = await adminClient.storage
      .from('pdf-history').upload(fileName, pdfBuffer, { contentType: 'application/pdf' });
    if (uploadErr) return NextResponse.json({ error: `스토리지 업로드 실패: ${uploadErr.message}` }, { status: 500 });

    if (answerPdfBase64 && answerFileName) {
      const answerBuffer = Buffer.from(answerPdfBase64, 'base64');
      await adminClient.storage.from('pdf-history').upload(answerFileName, answerBuffer, { contentType: 'application/pdf' });
    }

    const { error: insertErr } = await adminClient.from('mock_workbook_history').insert({
      academy_id: user.id,
      year,
      grade,
      institution,
      question_number: questionNumber,
      difficulty,
      pdf_path: fileName,
      answer_pdf_path: answerFileName,
    });

    if (insertErr) {
      await adminClient.storage.from('pdf-history').remove([fileName]);
      if (answerFileName) await adminClient.storage.from('pdf-history').remove([answerFileName]);
      return NextResponse.json({ error: `DB 저장 실패: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, pdf_path: fileName });
  } catch (error) {
    console.error('[save-mock-workbook-history] 오류:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, { status: 500 });
  }
}
