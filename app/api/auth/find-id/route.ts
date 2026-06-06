import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const { academy_name, mobile } = await req.json();

    if (!academy_name?.trim() || !mobile?.trim()) {
      return NextResponse.json({ error: '학원명과 휴대폰 번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: config, error: configError } = await supabaseAdmin
      .from('academy_config')
      .select('user_id')
      .eq('academy_name', academy_name.trim())
      .eq('mobile', mobile.trim())
      .single();

    if (configError || !config) {
      return NextResponse.json({ error: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(config.user_id);

    if (userError || !userData?.user?.email) {
      return NextResponse.json({ error: '계정 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ maskedEmail: maskEmail(userData.user.email) });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
