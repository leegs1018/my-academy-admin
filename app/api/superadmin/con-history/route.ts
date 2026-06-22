import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireSuperAdmin } from '../_auth';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const academySearch = searchParams.get('academy_search') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const typeFilter = searchParams.get('type') || 'all';
  const featureFilter = searchParams.get('feature_key') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 50;

  const db = createAdminClient();

  // 학원 검색 — academy_config에서 id 목록 조회
  let academyIds: string[] | null = null;
  if (academySearch) {
    const { data: academyRows } = await db
      .from('academy_config')
      .select('user_id, academy_name, email')
      .or(`academy_name.ilike.%${academySearch}%,email.ilike.%${academySearch}%`);
    academyIds = (academyRows ?? []).map((r: { user_id: string }) => r.user_id);
    if (academyIds.length === 0) {
      return NextResponse.json({ transactions: [], total: 0, page, pageSize, summary: { total_charge: 0, total_deduct: 0 } });
    }
  }

  let query = db
    .from('con_transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (academyIds) query = query.in('academy_id', academyIds);
  if (typeFilter !== 'all') query = query.eq('type', typeFilter);
  if (featureFilter !== 'all') {
    if (featureFilter === 'charge') {
      query = query.eq('type', 'charge');
    } else {
      query = query.eq('feature_key', featureFilter);
    }
  }
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) {
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    query = query.lt('created_at', endDateObj.toISOString().split('T')[0]);
  }

  const from = (page - 1) * pageSize;
  const { data: transactions, count, error } = await query.range(from, from + pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 집계 (전체 기간, 필터 동일 적용)
  let summaryQuery = db
    .from('con_transactions')
    .select('type, amount, feature_key');

  if (academyIds) summaryQuery = summaryQuery.in('academy_id', academyIds);
  if (typeFilter !== 'all') summaryQuery = summaryQuery.eq('type', typeFilter);
  if (featureFilter !== 'all' && featureFilter !== 'charge') summaryQuery = summaryQuery.eq('feature_key', featureFilter);
  if (featureFilter === 'charge') summaryQuery = summaryQuery.eq('type', 'charge');
  if (startDate) summaryQuery = summaryQuery.gte('created_at', startDate);
  if (endDate) {
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    summaryQuery = summaryQuery.lt('created_at', endDateObj.toISOString().split('T')[0]);
  }

  const { data: summaryRows } = await summaryQuery;
  const summary: {
    total_charge: number;
    total_deduct: number;
    by_feature: Record<string, number>;
  } = { total_charge: 0, total_deduct: 0, by_feature: {} };

  for (const row of summaryRows ?? []) {
    if (row.type === 'charge') {
      summary.total_charge += row.amount;
    } else {
      summary.total_deduct += row.amount;
      const key = row.feature_key || 'etc';
      summary.by_feature[key] = (summary.by_feature[key] || 0) + row.amount;
    }
  }

  // academy_id → academy_name 매핑
  const uniqueAcademyIds = [...new Set((transactions ?? []).map((t: { academy_id: string }) => t.academy_id))];
  let academyMap: Record<string, string> = {};
  if (uniqueAcademyIds.length > 0) {
    const { data: academyRows } = await db
      .from('academy_config')
      .select('user_id, academy_name, email')
      .in('user_id', uniqueAcademyIds);
    for (const a of academyRows ?? []) {
      academyMap[a.user_id] = a.academy_name || a.email || a.user_id;
    }
  }

  const enriched = (transactions ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    academy_name: academyMap[t.academy_id as string] || String(t.academy_id),
  }));

  return NextResponse.json({ transactions: enriched, total: count ?? 0, page, pageSize, summary });
}
