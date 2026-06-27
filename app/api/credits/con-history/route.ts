import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const typeFilter = searchParams.get('type') || 'all';
  const featureFilter = searchParams.get('feature_key') || 'all';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 30;

  const db = createAdminClient();

  let query = db
    .from('con_transactions')
    .select('*', { count: 'exact' })
    .eq('academy_id', user.id)
    .order('created_at', { ascending: false });

  if (typeFilter !== 'all') query = query.eq('type', typeFilter);
  if (featureFilter !== 'all') {
    if (featureFilter === 'charge') {
      query = query.eq('type', 'charge');
    } else {
      query = query.eq('feature_key', featureFilter);
    }
  }
  if (search) query = query.ilike('description', `%${search}%`);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) {
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    query = query.lt('created_at', endDateObj.toISOString().split('T')[0]);
  }

  const from = (page - 1) * pageSize;
  const { data: transactions, count, error } = await query.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 필터 조건과 동일하게 집계
  let summaryQuery = db
    .from('con_transactions')
    .select('type, amount, feature_key')
    .eq('academy_id', user.id);

  if (typeFilter !== 'all') summaryQuery = summaryQuery.eq('type', typeFilter);
  if (featureFilter !== 'all') {
    if (featureFilter === 'charge') {
      summaryQuery = summaryQuery.eq('type', 'charge');
    } else {
      summaryQuery = summaryQuery.eq('feature_key', featureFilter);
    }
  }
  if (search) summaryQuery = summaryQuery.ilike('description', `%${search}%`);
  if (startDate) summaryQuery = summaryQuery.gte('created_at', startDate);
  if (endDate) {
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    summaryQuery = summaryQuery.lt('created_at', endDateObj.toISOString().split('T')[0]);
  }

  const { data: summaryRows } = await summaryQuery;
  let totalCharge = 0;
  let totalDeduct = 0;
  for (const row of summaryRows ?? []) {
    if (row.type === 'charge') totalCharge += row.amount;
    else totalDeduct += row.amount;
  }

  return NextResponse.json({
    transactions: transactions ?? [],
    total: count ?? 0,
    page,
    pageSize,
    summary: { total_charge: totalCharge, total_deduct: totalDeduct },
  });
}
