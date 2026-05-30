import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // pdf_history
    const { data: pdfOld } = await adminClient
      .from('pdf_history').select('pdf_path, answer_pdf_path').lt('created_at', cutoff);
    if (pdfOld && pdfOld.length > 0) {
      const paths = pdfOld.flatMap(r => [r.pdf_path, r.answer_pdf_path].filter(Boolean) as string[]);
      if (paths.length > 0) await adminClient.storage.from('pdf-history').remove(paths);
      await adminClient.from('pdf_history').delete().lt('created_at', cutoff);
    }

    // exam_question_history
    const { data: eqOld } = await adminClient
      .from('exam_question_history').select('question_pdf_path, answer_pdf_path').lt('created_at', cutoff);
    if (eqOld && eqOld.length > 0) {
      const paths = eqOld.flatMap(r => [r.question_pdf_path, r.answer_pdf_path].filter(Boolean) as string[]);
      if (paths.length > 0) await adminClient.storage.from('pdf-history').remove(paths);
      await adminClient.from('exam_question_history').delete().lt('created_at', cutoff);
    }

    // mock_workbook_history
    const { data: mwOld } = await adminClient
      .from('mock_workbook_history').select('pdf_path, answer_pdf_path').lt('created_at', cutoff);
    if (mwOld && mwOld.length > 0) {
      const paths = mwOld.flatMap(r => [r.pdf_path, r.answer_pdf_path].filter(Boolean) as string[]);
      if (paths.length > 0) await adminClient.storage.from('pdf-history').remove(paths);
      await adminClient.from('mock_workbook_history').delete().lt('created_at', cutoff);
    }

    // mock_exam_question_history
    const { data: meqOld } = await adminClient
      .from('mock_exam_question_history').select('question_pdf_path, answer_pdf_path').lt('created_at', cutoff);
    if (meqOld && meqOld.length > 0) {
      const paths = meqOld.flatMap(r => [r.question_pdf_path, r.answer_pdf_path].filter(Boolean) as string[]);
      if (paths.length > 0) await adminClient.storage.from('pdf-history').remove(paths);
      await adminClient.from('mock_exam_question_history').delete().lt('created_at', cutoff);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[cleanup-old-history] 오류:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '오류' }, { status: 500 });
  }
}
