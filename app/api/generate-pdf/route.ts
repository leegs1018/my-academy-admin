import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function launchBrowser() {
  if (process.env.NODE_ENV === 'production') {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const puppeteer = (await import('puppeteer')).default;
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
}

export async function POST(request: Request) {
  let browser;
  try {
    const { htmlBase64 } = await request.json() as { htmlBase64: string };

    if (!htmlBase64) {
      return NextResponse.json({ error: 'HTML 내용이 없습니다.' }, { status: 400 });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

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
