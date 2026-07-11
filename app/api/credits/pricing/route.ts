import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('con_pricing')
    .select('feature_key, cost_per_use, unit_description')
    .eq('is_active', true)
    .order('feature_key');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pricing: data }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
