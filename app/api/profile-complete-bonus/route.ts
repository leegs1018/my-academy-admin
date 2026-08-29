import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 프로필 완성 보너스 200C — 학원명 + (전화번호 or 휴대폰) 첫 완성 시 1회 지급
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = auth.slice(7);

  const db = createAdminClient();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // 중복 방지: 이미 profile_completion_bonus 트랜잭션이 있으면 skip
  const { data: existing } = await db
    .from('con_transactions')
    .select('id')
    .eq('academy_id', user.id)
    .eq('feature_key', 'profile_completion_bonus')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const BONUS = 200;

  // 현재 잔액 조회
  const { data: academy } = await db
    .from('academy_config')
    .select('points')
    .eq('user_id', user.id)
    .single();

  if (!academy) return NextResponse.json({ error: 'Academy not found' }, { status: 404 });

  const newBalance = (academy.points ?? 0) + BONUS;

  // points 업데이트
  await db.from('academy_config').update({ points: newBalance }).eq('user_id', user.id);

  // 트랜잭션 기록
  await db.from('con_transactions').insert({
    academy_id: user.id,
    type: 'charge',
    amount: BONUS,
    balance_after: newBalance,
    feature_key: 'profile_completion_bonus',
    description: '프로필 완성 보너스',
  });

  return NextResponse.json({ success: true, bonus: BONUS, new_balance: newBalance });
}
