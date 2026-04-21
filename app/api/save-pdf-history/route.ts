import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify user via Bearer token from client
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
    }

    const { htmlBase64, passageExcerpt, passageFull, passageType, difficulty } =
      await request.json() as {
        htmlBase64: string;
        passageExcerpt: string;
        passageFull: string;
        passageType: string;
        difficulty: string;
      };

    if (!htmlBase64) {
      return NextResponse.json({ error: 'HTML 내용이 없습니다.' }, { status: 400 });
    }

    // Generate PDF
    let browser;
    let pdfBuffer: Uint8Array;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.goto(`data:text/html;base64,${htmlBase64}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
    } finally {
      if (browser) await browser.close();
    }

    const fileName = `${user.id}/${Date.now()}.pdf`;
    const { error: uploadErr } = await adminClient.storage
      .from('pdf-history')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf' });

    if (uploadErr) {
      console.error('[save-pdf-history] storage upload error:', uploadErr);
      return NextResponse.json({ error: `스토리지 업로드 실패: ${uploadErr.message}` }, { status: 500 });
    }

    const { error: insertErr } = await adminClient.from('pdf_history').insert({
      academy_id: user.id,
      passage_excerpt: passageExcerpt,
      passage_full: passageFull,
      passage_type: passageType,
      difficulty,
      pdf_path: fileName,
    });

    if (insertErr) {
      console.error('[save-pdf-history] db insert error:', insertErr);
      // Clean up uploaded file
      await adminClient.storage.from('pdf-history').remove([fileName]);
      return NextResponse.json({ error: `DB 저장 실패: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, pdf_path: fileName });
  } catch (error) {
    console.error('[save-pdf-history] 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
