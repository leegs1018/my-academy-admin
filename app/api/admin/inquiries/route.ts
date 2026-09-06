import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendPpurioSms } from '@/lib/ppurio';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) {},
        remove(_n: string, _o: CookieOptions) {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('academy_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(_n: string, _v: string, _o: CookieOptions) {},
        remove(_n: string, _o: CookieOptions) {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, content } = await request.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('inquiries')
    .insert([{ academy_id: user.id, title, content }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 관리자 SMS 알림
  try {
    const admin = createAdminClient();
    const [phoneRes, toggleRes] = await Promise.all([
      admin.from('site_settings').select('value').eq('key', 'admin_notify_phone').single(),
      admin.from('site_settings').select('value').eq('key', 'notify_inquiry_sms').single(),
    ]);
    const adminPhone = phoneRes.data?.value?.trim();
    const smsEnabled = (toggleRes.data?.value ?? 'true') !== 'false';
    if (adminPhone && smsEnabled) {
      const { data: academy } = await admin
        .from('academy_config')
        .select('academy_name')
        .eq('user_id', user.id)
        .single();
      const academyName = academy?.academy_name ?? user.email ?? '(알 수 없음)';
      await sendPpurioSms(
        adminPhone,
        `[CON EDU] 새 문의사항\n학원: ${academyName}\n제목: ${title}`,
      );
    }
  } catch { /* 알림 실패는 문의 등록에 영향 없음 */ }

  return NextResponse.json({ inquiry: data }, { status: 201 });
}
