import { NextResponse } from 'next/server';
import { sendAlimtalk, AlimtalkPayload } from '@/lib/ppurio';

export async function POST(req: Request) {
  const payload = await req.json() as AlimtalkPayload;
  try {
    const result = await sendAlimtalk(payload);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[alimtalk/send] 오류:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
