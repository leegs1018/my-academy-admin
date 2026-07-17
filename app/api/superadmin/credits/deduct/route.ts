import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { academy_id, amount, description } = await request.json() as {
    academy_id: string;
    amount: number;
    description: string;
  };

  if (!academy_id || !amount || amount <= 0) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const db = createAdminClient();

  // 잔액 조회
  const { data: cfg } = await db
    .from('academy_config')
    .select('points')
    .eq('user_id', academy_id)
    .single();

  if (!cfg) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

  const currentPoints = cfg.points ?? 0;
  const newPoints = Math.max(0, currentPoints - amount);
  const actualDeduct = currentPoints - newPoints;

  if (actualDeduct <= 0) {
    return NextResponse.json({ error: '잔액이 없어 차감할 수 없습니다.' }, { status: 400 });
  }

  const { error: updateError } = await db
    .from('academy_config')
    .update({ points: newPoints })
    .eq('user_id', academy_id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const deductDesc = description || `슈퍼어드민 CON 차감 (${actualDeduct} CON)`;

  await db.from('con_transactions').insert({
    academy_id,
    type: 'deduct',
    amount: actualDeduct,
    balance_after: newPoints,
    description: deductDesc,
    feature_key: 'admin_deduct',
    is_free: false,
  });

  return NextResponse.json({ success: true, new_balance: newPoints });
}
