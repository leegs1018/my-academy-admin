'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface RevenueRow {
  id: string;
  date: string;
  kind: 'revenue' | 'expense' | 'refund';
  title: string;
  content: string;
  amount_krw: number;
  currency: 'KRW' | 'USD';
  original_amount?: number;
  fx_rate?: number;
}

interface Summary {
  revenue: number;
  expense: number;
  refund: number;
  net: number;
}

const KIND_LABEL: Record<RevenueRow['kind'], string> = { revenue: '매출', expense: '매입', refund: '환불' };
const KIND_COLOR: Record<RevenueRow['kind'], string> = {
  revenue: 'bg-emerald-900/50 text-emerald-400',
  expense: 'bg-sky-900/50 text-sky-400',
  refund: 'bg-red-900/50 text-red-400',
};

function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear().toString().slice(2)}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
}

export default function RevenuePage() {
  const today = toLocalDate(new Date());

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>({ revenue: 0, expense: 0, refund: 0, net: 0 });
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    setSearchError('');
    const params = new URLSearchParams({
      search: debouncedSearch,
      start_date: startDate,
      end_date: endDate,
      page: String(p),
    });
    try {
      const res = await fetch(`/api/superadmin/revenue?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setRows(data.transactions || []);
      setTotal(data.total || 0);
      setSummary(data.summary ?? { revenue: 0, expense: 0, refund: 0, net: 0 });
      setPage(p);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, startDate, endDate]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">💰 매출 분석</h1>
          <p className="text-sm text-slate-500 mt-1 font-bold">
            실제 결제 금액(원) 기준 매출·매입·환불 현황입니다. 무료 지급 CON은 매출에 포함되지 않습니다.
          </p>
        </div>
        <Link href="/superadmin/revenue/fixed-costs"
          className="shrink-0 px-4 py-2.5 text-sm font-black bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all whitespace-nowrap">
          ⚙️ 고정비/단건 관리
        </Link>
      </div>

      {/* 필터 영역 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">검색 (제목 또는 내용)</label>
            <input
              type="text"
              placeholder="학원명, 고정비 제목/내용으로 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData(1)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">조회</label>
            <button
              onClick={() => fetchData(1)}
              className="w-full py-2.5 text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
            >
              검색
            </button>
          </div>
        </div>
        {/* 날짜 퀵버튼 */}
        <div className="flex flex-wrap gap-2">
          {([
            { label: '오늘', fn: () => { const d = toLocalDate(new Date()); setStartDate(d); setEndDate(d); } },
            { label: '어제', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = toLocalDate(d); setStartDate(s); setEndDate(s); } },
            { label: '지난 7일', fn: () => { const s = new Date(); s.setDate(s.getDate() - 6); setStartDate(toLocalDate(s)); setEndDate(toLocalDate(new Date())); } },
            { label: '지난 30일', fn: () => { const s = new Date(); s.setDate(s.getDate() - 29); setStartDate(toLocalDate(s)); setEndDate(toLocalDate(new Date())); } },
            { label: '3개월', fn: () => { const s = new Date(); s.setMonth(s.getMonth() - 3); setStartDate(toLocalDate(s)); setEndDate(toLocalDate(new Date())); } },
            { label: '6개월', fn: () => { const s = new Date(); s.setMonth(s.getMonth() - 6); setStartDate(toLocalDate(s)); setEndDate(toLocalDate(new Date())); } },
            { label: '12개월', fn: () => { const s = new Date(); s.setMonth(s.getMonth() - 12); setStartDate(toLocalDate(s)); setEndDate(toLocalDate(new Date())); } },
          ] as const).map(({ label, fn }) => (
            <button key={label} onClick={fn}
              className="px-3 py-1.5 text-xs font-black bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:border-indigo-500 transition-all">
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {searchError && (
        <div className="bg-red-950 border border-red-800 rounded-2xl p-4 text-sm font-bold text-red-300">
          ⚠️ {searchError}
        </div>
      )}

      {/* 집계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">매출</p>
          <p className="text-2xl font-black text-emerald-400">+{summary.revenue.toLocaleString()}원</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">매입</p>
          <p className="text-2xl font-black text-sky-400">-{summary.expense.toLocaleString()}원</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">환불</p>
          <p className="text-2xl font-black text-red-400">-{summary.refund.toLocaleString()}원</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">순이익</p>
          <p className={`text-2xl font-black ${summary.net >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {summary.net >= 0 ? '+' : ''}{summary.net.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 거래 테이블 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-black text-white">총 {total.toLocaleString()}건</span>
          {loading && <span className="text-xs font-bold text-slate-400 animate-pulse">불러오는 중...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">날짜</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500 whitespace-nowrap">구분</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">제목</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">내용</th>
                <th className="py-3 px-4 text-right text-xs font-black text-slate-500 whitespace-nowrap">금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${KIND_COLOR[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td className="py-3 px-4 font-black text-white text-xs whitespace-nowrap">{r.title}</td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-300">
                    {r.content}
                    {r.currency === 'USD' && r.original_amount !== undefined && (
                      <span className="text-slate-500 font-bold ml-1.5">
                        (${r.original_amount.toLocaleString()} · {r.fx_rate ? `${r.fx_rate.toLocaleString()}원 환율 적용` : '환율 조회 실패'})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                    <span className={r.kind === 'revenue' ? 'text-emerald-400' : r.kind === 'expense' ? 'text-sky-400' : 'text-red-400'}>
                      {r.kind === 'revenue' ? '+' : '-'}{r.amount_krw.toLocaleString()}원
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-600 font-bold">
                    해당 기간에 기록이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => fetchData(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all disabled:opacity-30"
            >
              이전
            </button>
            <span className="text-xs font-bold text-slate-400">{page} / {totalPages}</span>
            <button
              onClick={() => fetchData(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all disabled:opacity-30"
            >
              다음
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-600 font-bold">
        * CON 결제 내역은 이 기능 배포 이전 거래의 경우 실제 결제 금액이 기록되어 있지 않아 집계에서 제외됩니다. 고정/단건 매출·매입은 <Link href="/superadmin/revenue/fixed-costs" className="underline">고정비/단건 관리</Link>에서 등록·관리합니다.
      </p>
    </div>
  );
}
