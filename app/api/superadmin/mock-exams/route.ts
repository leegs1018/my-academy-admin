import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const { data, error } = await adminClient()
      .from('mock_exam_passages')
      .select('*')
      .order('year', { ascending: false })
      .order('institution')
      .order('question_number');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ passages: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      year: number;
      institution: string;
      grade: string;
      exam_name: string;
      question_number: number;
      passage_text: string;
    };

    const { error } = await adminClient()
      .from('mock_exam_passages')
      .insert(body);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      id: string;
      year: number;
      institution: string;
      grade: string;
      exam_name: string;
      question_number: number;
      passage_text: string;
    };

    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id 없음' }, { status: 400 });

    const { error } = await adminClient()
      .from('mock_exam_passages')
      .update(fields)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 없음' }, { status: 400 });

    const { error } = await adminClient()
      .from('mock_exam_passages')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}
