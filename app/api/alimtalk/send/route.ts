import { NextResponse } from 'next/server';
import { sendAlimtalk, AlimtalkPayload } from '@/lib/ppurio';

export async function POST(req: Request) {
  const { academy_id, ...payload } = await req.json() as AlimtalkPayload & { academy_id?: string };
  try {
    const result = await sendAlimtalk(payload, academy_id);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('[alimtalk/send] 오류:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
