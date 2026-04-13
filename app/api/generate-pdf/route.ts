import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let browser;
  try {
    const { htmlBase64 } = await request.json() as { htmlBase64: string };

    if (!htmlBase64) {
      return NextResponse.json({ error: 'HTML 내용이 없습니다.' }, { status: 400 });
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    // base64 data URL로 로드 — 한글이 URL/CDP 명령에 들어가지 않아 ByteString 오류 방지
    await page.goto(`data:text/html;base64,${htmlBase64}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  } catch (error) {
    console.error('[generate-pdf] 오류:', error);
    return NextResponse.json({ error: 'PDF 생성에 실패했습니다.' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
