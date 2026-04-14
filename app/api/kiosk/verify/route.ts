import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { kiosk_code } = await req.json();

  if (!kiosk_code || kiosk_code.length !== 6) {
    return NextResponse.json({ error: '올바른 6자리 코드를 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('academy_config')
    .select('user_id, academy_name, kiosk_code')
    .eq('kiosk_code', kiosk_code)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '등록되지 않은 학원 코드입니다.' }, { status: 404 });
  }

  // students.academy_id 는 academy_config.user_id(Supabase auth user id)와 동일
  return NextResponse.json({
    academy_id: data.user_id,
    academy_name: data.academy_name,
  });
}
