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
    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
    }

    const { history_id, question_index, question_type, question_json, passage_text, con_amount, rating } =
      await request.json() as {
        history_id: string;
        question_index: number;
        question_type: string;
        question_json: object;
        passage_text?: string;
        con_amount: number;
        rating: 'good' | 'bad';
      };

    if (!history_id || !question_type || !question_json || !rating) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const { data: academy } = await adminClient
      .from('academy_config')
      .select('academy_name')
      .eq('user_id', user.id)
      .single();

    const { error: insertErr } = await adminClient
      .from('question_reports')
      .insert({
        academy_id: user.id,
        user_email: user.email,
        academy_name: academy?.academy_name ?? '',
        history_id,
        question_index: question_index ?? 0,
        question_type,
        question_json,
        passage_text: passage_text ?? '',
        con_amount: con_amount ?? 1,
        rating,
        status: 'pending',
      });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[report-question] 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
