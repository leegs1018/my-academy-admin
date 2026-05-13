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

  const { feature_key, cost_per_use } = await request.json() as {
    feature_key: string;
    cost_per_use: number;
  };

  if (!feature_key || cost_per_use == null || cost_per_use < 0) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('con_pricing')
    .update({ cost_per_use, updated_at: new Date().toISOString() })
    .eq('feature_key', feature_key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
