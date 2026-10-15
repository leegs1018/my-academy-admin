import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireSuperAdmin } from '../_auth';

// KST 날짜 → UTC ISO 변환 (KST = UTC+9), con-history 라우트와 동일한 규칙.
const toKstStartUTC = (d: string) => new Date(d + 'T00:00:00+09:00').toISOString();
const toKstEndUTC = (d: string) => { const dt = new Date(d + 'T00:00:00+09:00'); dt.setDate(dt.getDate() + 1); return dt.toISOString(); };

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const academySearch = (searchParams.get('academy_search') || '').trim();
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 50;

    const db = createAdminClient();

    let academyIds: string[] | null = null;
    if (academySearch) {
      const safe = academySearch.replace(/[%_\\]/g, c => `\\${c}`);
      const { data: academyRows } = await db
        .from('academy_config')
        .select('user_id')
        .ilike('academy_name', `%${safe}%`);
      academyIds = (academyRows ?? []).map((r: { user_id: string }) => r.user_id);
      if (academyIds.length === 0) {
        return NextResponse.json({
          transactions: [], total: 0, page, pageSize,
          summary: { revenue: 0, refund: 0, net: 0 },
        });
      }
    }

    // 매출/환불 모두 amount_krw가 실제로 기록된 거래만 대상으로 한다
    // (이 기능 배포 이전 거래는 amount_krw가 없어 자동으로 집계에서 빠진다).
    let query = db
      .from('con_transactions')
      .select('id, academy_id, type, feature_key, description, amount, amount_krw, created_at', { count: 'exact' })
      .not('amount_krw', 'is', null)
      .or('and(type.eq.charge,is_free.eq.false),and(type.eq.deduct,feature_key.eq.payapp_refund)')
      .order('created_at', { ascending: false });

    if (academyIds) query = query.in('academy_id', academyIds);
    if (startDate) query = query.gte('created_at', toKstStartUTC(startDate));
    if (endDate) query = query.lt('created_at', toKstEndUTC(endDate));

    const from = (page - 1) * pageSize;
    const { data: transactions, count, error } = await query.range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 집계 (전체 기간, 페이지네이션과 무관하게 동일 필터로 별도 조회)
    let summaryQuery = db
      .from('con_transactions')
      .select('type, feature_key, amount_krw')
      .not('amount_krw', 'is', null)
      .or('and(type.eq.charge,is_free.eq.false),and(type.eq.deduct,feature_key.eq.payapp_refund)');
    if (academyIds) summaryQuery = summaryQuery.in('academy_id', academyIds);
    if (startDate) summaryQuery = summaryQuery.gte('created_at', toKstStartUTC(startDate));
    if (endDate) summaryQuery = summaryQuery.lt('created_at', toKstEndUTC(endDate));

    const { data: summaryRows } = await summaryQuery;
    let revenue = 0, refund = 0;
    for (const row of summaryRows ?? []) {
      const krw = (row as { amount_krw: number | null }).amount_krw ?? 0;
      if (row.type === 'charge') revenue += krw;
      else refund += krw;
    }

    // academy_id → academy_name 매핑
    const uniqueAcademyIds = [...new Set((transactions ?? []).map((t: { academy_id: string }) => t.academy_id))];
    const academyMap: Record<string, string> = {};
    if (uniqueAcademyIds.length > 0) {
      const { data: academyRows } = await db
        .from('academy_config')
        .select('user_id, academy_name')
        .in('user_id', uniqueAcademyIds);
      for (const a of academyRows ?? []) academyMap[a.user_id] = a.academy_name || a.user_id;
    }

    const enriched = (transactions ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      academy_name: academyMap[t.academy_id as string] || '(삭제된 학원)',
    }));

    return NextResponse.json({
      transactions: enriched, total: count ?? 0, page, pageSize,
      summary: { revenue, refund, net: revenue - refund },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
