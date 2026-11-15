import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireSuperAdmin } from '../_auth';
import { getUsdKrwRate } from '@/lib/fxRate';
import { materializeOccurrences } from '@/lib/fixedCosts';

// KST 날짜 → UTC ISO 변환 (KST = UTC+9), con-history 라우트와 동일한 규칙.
const toKstStartUTC = (d: string) => new Date(d + 'T00:00:00+09:00').toISOString();
const toKstEndUTC = (d: string) => { const dt = new Date(d + 'T00:00:00+09:00'); dt.setDate(dt.getDate() + 1); return dt.toISOString(); };
// con_transactions.created_at(UTC) → KST 기준 날짜(YYYY-MM-DD)
const toKstDateOnly = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

interface RevenueRow {
  id: string;
  date: string; // YYYY-MM-DD
  kind: 'revenue' | 'expense' | 'refund';
  title: string;
  content: string;
  amount_krw: number;
  currency: 'KRW' | 'USD';
  original_amount?: number;
  fx_rate?: number;
}

function conProductName(type: 'charge' | 'deduct', featureKey: string | null, amount: number): string {
  if (type === 'charge') {
    if (featureKey === 'payapp_charge') return `CON ${amount.toLocaleString()}개 충전 (카드결제)`;
    return `CON ${amount.toLocaleString()}개 충전 (계좌이체)`;
  }
  return `카드결제 환불 (CON ${amount.toLocaleString()}개)`;
}

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || searchParams.get('academy_search') || '').trim().toLowerCase();
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 50;

    const db = createAdminClient();
    const rows: RevenueRow[] = [];

    // ── 1) CON 거래(매출/환불) ──────────────────────────────────────────
    let conQuery = db
      .from('con_transactions')
      .select('id, academy_id, type, feature_key, amount, amount_krw, created_at')
      .not('amount_krw', 'is', null)
      .or('and(type.eq.charge,is_free.eq.false),and(type.eq.deduct,feature_key.eq.payapp_refund)');
    if (startDate) conQuery = conQuery.gte('created_at', toKstStartUTC(startDate));
    if (endDate) conQuery = conQuery.lt('created_at', toKstEndUTC(endDate));
    const { data: conRows, error: conError } = await conQuery;
    if (conError) return NextResponse.json({ error: conError.message }, { status: 500 });

    const uniqueAcademyIds = [...new Set((conRows ?? []).map(r => r.academy_id as string))];
    const academyMap: Record<string, string> = {};
    if (uniqueAcademyIds.length > 0) {
      const { data: academyRows } = await db
        .from('academy_config')
        .select('user_id, academy_name')
        .in('user_id', uniqueAcademyIds);
      for (const a of academyRows ?? []) academyMap[a.user_id] = a.academy_name || a.user_id;
    }

    for (const r of conRows ?? []) {
      const academyName = academyMap[r.academy_id as string] || '(삭제된 학원)';
      rows.push({
        id: `con-${r.id}`,
        date: toKstDateOnly(r.created_at as string),
        kind: r.type === 'charge' ? 'revenue' : 'refund',
        title: academyName,
        content: conProductName(r.type as 'charge' | 'deduct', r.feature_key as string | null, r.amount as number),
        amount_krw: r.amount_krw as number,
        currency: 'KRW',
      });
    }

    // ── 2) 고정비(고정 매출/매입) 발생일 펼치기 ──────────────────────────
    if (startDate && endDate) {
      const { data: fixedCosts } = await db.from('fixed_costs').select('*');
      const rateCache = new Map<string, number>();

      for (const fc of fixedCosts ?? []) {
        const occurrences = materializeOccurrences(
          fc.start_date, fc.end_date, fc.repeat_cycle as 'weekly' | 'monthly' | 'once', startDate, endDate
        );
        for (const occDate of occurrences) {
          let amountKrw = Number(fc.amount);
          let fxRate: number | undefined;
          if (fc.currency === 'USD') {
            if (!rateCache.has(occDate)) {
              try {
                const { rate } = await getUsdKrwRate(occDate);
                rateCache.set(occDate, rate);
              } catch {
                rateCache.set(occDate, 0);
              }
            }
            fxRate = rateCache.get(occDate) ?? 0;
            amountKrw = Math.round(Number(fc.amount) * fxRate);
          }
          rows.push({
            id: `fixed-${fc.id}-${occDate}`,
            date: occDate,
            kind: fc.type === 'revenue' ? 'revenue' : 'expense',
            title: fc.title,
            content: fc.description || fc.title,
            amount_krw: amountKrw,
            currency: fc.currency,
            original_amount: fc.currency === 'USD' ? Number(fc.amount) : undefined,
            fx_rate: fxRate,
          });
        }
      }
    }

    // ── 3) 검색(제목 or 내용) 필터 — 서버에서 통합 적용 ──────────────────
    const filtered = search
      ? rows.filter(r => r.title.toLowerCase().includes(search) || r.content.toLowerCase().includes(search))
      : rows;

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    // ── 4) 집계 카드 ──────────────────────────────────────────────────
    let revenue = 0, expense = 0, refund = 0;
    for (const r of filtered) {
      if (r.kind === 'revenue') revenue += r.amount_krw;
      else if (r.kind === 'expense') expense += r.amount_krw;
      else refund += r.amount_krw;
    }

    // ── 5) 페이지네이션(병합 후 메모리상에서) ────────────────────────────
    const total = filtered.length;
    const from = (page - 1) * pageSize;
    const paged = filtered.slice(from, from + pageSize);

    return NextResponse.json({
      transactions: paged, total, page, pageSize,
      summary: { revenue, expense, refund, net: revenue - expense - refund },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
