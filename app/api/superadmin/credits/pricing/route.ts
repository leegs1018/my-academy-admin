import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('con_pricing')
    .select('*')
    .order('feature_key');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pricing: data });
}

export async function PUT(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const body = await request.json() as {
    feature_key: string;
    cost_per_use?: number;
    is_active?: boolean;
  };
  const { feature_key, cost_per_use, is_active } = body;

  if (!feature_key) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (cost_per_use != null) {
    if (cost_per_use < 0) return NextResponse.json({ error: '단가는 0 이상이어야 합니다.' }, { status: 400 });
    updatePayload.cost_per_use = cost_per_use;
  }
  if (is_active != null) {
    updatePayload.is_active = is_active;
  }

  const { error } = await supabase
    .from('con_pricing')
    .update(updatePayload)
    .eq('feature_key', feature_key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
