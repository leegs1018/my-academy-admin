import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 온보딩 선택 팝업을 다시 띄우지 않기 위한 플래그 저장.
// 클라이언트에서 직접 academy_config를 업데이트하면 RLS 등으로 실패해도 알아챌 수 없으므로,
// service role로 확실하게 기록하고 실패 시 에러를 돌려준다.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });

  const { error } = await admin.from('academy_config').update({ onboarding_seen: true }).eq('user_id', user.id);
  if (error) {
    console.error('[dismiss-onboarding] 저장 실패:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
