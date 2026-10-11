import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 대시보드 상단 "AI 체험 안내 배너" 노출 여부 판단용.
// AI 문제를 한 번도 생성해본 적 없고, 배너를 닫은 적도 없는 회원에게만 보여준다.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });

  const { data } = await admin
    .from('events_log')
    .select('event_name')
    .eq('user_id', user.id)
    .in('event_name', ['generation_completed', 'ai_banner_dismissed'])
    .limit(1000);

  const rows = data ?? [];
  const hasGenerated = rows.some(r => r.event_name === 'generation_completed');
  const dismissed = rows.some(r => r.event_name === 'ai_banner_dismissed');

  return NextResponse.json({ showBanner: !hasGenerated && !dismissed });
}
