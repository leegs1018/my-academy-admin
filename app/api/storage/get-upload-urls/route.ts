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

    const ts = Date.now();
    const questionPath = `exam/${user.id}/${ts}.pdf`;
    const answerPath = `exam/${user.id}/${ts}_answer.pdf`;

    const [{ data: qData, error: qErr }, { data: aData, error: aErr }] = await Promise.all([
      adminClient.storage.from('pdf-history').createSignedUploadUrl(questionPath),
      adminClient.storage.from('pdf-history').createSignedUploadUrl(answerPath),
    ]);

    if (qErr || !qData) {
      console.error('[get-upload-urls] 서명 URL 생성 실패:', qErr);
      return NextResponse.json({ error: `서명 URL 생성 실패: ${qErr?.message}` }, { status: 500 });
    }

    return NextResponse.json({
      question: { path: questionPath, signedUrl: qData.signedUrl, token: qData.token },
      answer: aErr || !aData ? null : { path: answerPath, signedUrl: aData.signedUrl, token: aData.token },
    });
  } catch (error) {
    console.error('[get-upload-urls] 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
