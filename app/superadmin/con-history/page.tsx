'use client';

import { useState, useEffect, useCallback } from 'react';

interface Transaction {
  id: string;
  academy_id: string;
  academy_name: string;
  type: 'charge' | 'deduct';
  amount: number;
  balance_after: number;
  feature_key: string | null;
  description: string;
  created_at: string;
  created_by: string | null;
}

interface Summary {
  total_charge: number;
  total_deduct: number;
  by_feature: Record<string, number>;
}

const FEATURE_LABELS: Record<string, string> = {
  pdf_analysis: '지문분석 툴/워크북',
  mock_workbook: '모의고사 툴/워크북',
  ai_question_per_type: '실전변형 문제',
  mock_exam_question_per_type: '모의고사변형 문제',
  vocab_choice: '어휘 선택 문제',
  sms: 'SMS',
  lms: 'LMS',
  payapp_charge: '카드결제',
  payapp_refund: '카드결제 환불',
  admin_deduct: '관리자 차감',
};

const FEATURE_FILTER_OPTIONS = [
  { value: 'all', label: '전체 기능' },
  { value: 'pdf_analysis', label: '지문분석 툴/워크북' },
  { value: 'mock_workbook', label: '모의고사 툴/워크북' },
  { value: 'ai_question_per_type', label: '실전변형 문제' },
  { value: 'mock_exam_question_per_type', label: '모의고사변형 문제' },
  { value: 'vocab_choice', label: '어휘 선택 문제' },
  { value: 'sms', label: 'SMS' },
  { value: 'lms', label: 'LMS' },
];

function getThisMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${lastDay}` };
}

export default function ConHistoryPage() {
  const { start: defaultStart, end: defaultEnd } = getThisMonthRange();

  const [academySearch, setAcademySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [typeFilter, setTypeFilter] = useState('all');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>({ total_charge: 0, total_deduct: 0, by_feature: {} });
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 300ms 디바운스
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(academySearch), 300);
    return () => clearTimeout(t);
  }, [academySearch]);

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    setSearchError('');
    const params = new URLSearchParams({
      academy_search: debouncedSearch,
      start_date: startDate,
      end_date: endDate,
      type: typeFilter,
      feature_key: featureFilter,
      page: String(p),
    });
    try {
      const res = await fetch(`/api/superadmin/con-history?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
      setSummary(data.summary ? { by_feature: {}, ...data.summary } : { total_charge: 0, total_deduct: 0, by_feature: {} });
      setPage(p);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, startDate, endDate, typeFilter, featureFilter]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const featureLabel = (key: string | null) => {
    if (!key) return '-';
    return FEATURE_LABELS[key] || key;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">📋 CON 이력 조회</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">CON 충전 및 사용 이력을 조회합니다</p>
      </div>

      {/* 필터 영역 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">학원 검색</label>
            <input
              type="text"
              placeholder="학원명으로 검색"
              value={academySearch}
              onChange={e => setAcademySearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData(1)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">유형</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="charge">충전</option>
              <option value="deduct">사용</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">기능</label>
            <select
              value={featureFilter}
              onChange={e => setFeatureFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
            >
              {FEATURE_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">총 충전</p>
          <p className="text-2xl font-black text-emerald-400">+{summary.total_charge.toLocaleString()} C</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">총 사용</p>
          <p className="text-2xl font-black text-red-400">-{summary.total_deduct.toLocaleString()} C</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-slate-500 mb-1">순 변동</p>
          <p className={`text-2xl font-black ${summary.total_charge - summary.total_deduct >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {summary.total_charge - summary.total_deduct >= 0 ? '+' : ''}{(summary.total_charge - summary.total_deduct).toLocaleString()} C
          </p>
        </div>
      </div>

      {/* 기능별 사용량 */}
      {Object.keys(summary.by_feature).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-black text-white mb-3">기능별 사용량</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.by_feature)
              .sort(([, a], [, b]) => b - a)
              .map(([key, amount]) => (
                <div key={key} className="bg-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-black text-slate-300">{featureLabel(key)}</span>
                  <span className="text-xs font-black text-yellow-400">{amount.toLocaleString()} C</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 트랜잭션 테이블 */}
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
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">학원</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500 whitespace-nowrap">유형</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">기능</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">내용</th>
                <th className="py-3 px-4 text-right text-xs font-black text-slate-500 whitespace-nowrap">금액</th>
                <th className="py-3 px-4 text-right text-xs font-black text-slate-500 whitespace-nowrap">잔액</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                  <td className="py-3 px-4 font-black text-white text-xs whitespace-nowrap">{t.academy_name}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${t.type === 'charge' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                      {t.type === 'charge' ? '충전' : '사용'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-400 whitespace-nowrap">{featureLabel(t.feature_key)}</td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-300 max-w-[200px] truncate">{t.description}</td>
                  <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                    <span className={t.type === 'charge' ? 'text-emerald-400' : 'text-red-400'}>
                      {t.type === 'charge' ? '+' : '-'}{t.amount.toLocaleString()} C
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-yellow-400 whitespace-nowrap">{t.balance_after.toLocaleString()} C</td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-600 font-bold">이력이 없습니다</td>
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
    </div>
  );
}
