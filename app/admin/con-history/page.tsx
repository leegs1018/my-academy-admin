'use client';

import { useState, useEffect, useCallback } from 'react';

interface ConTx {
  id: string;
  type: 'charge' | 'deduct';
  amount: number;
  balance_after: number;
  feature_key: string | null;
  description: string | null;
  created_at: string;
}

const FEATURE_LABELS: Record<string, { label: string; color: string }> = {
  pdf_analysis:                  { label: '지문분석',  color: 'text-blue-400' },
  mock_workbook:                 { label: '워크북',    color: 'text-indigo-400' },
  ai_question_per_type:          { label: '실전변형',  color: 'text-purple-400' },
  mock_exam_question_per_type:   { label: '실전변형',  color: 'text-purple-400' },
  vocab_choice:                  { label: '어휘선택',  color: 'text-pink-400' },
  sms:                           { label: 'SMS',       color: 'text-green-400' },
  lms:                           { label: 'LMS',       color: 'text-teal-400' },
  kiosk:                         { label: '키오스크',  color: 'text-orange-400' },
};

const FEATURE_OPTIONS = [
  { value: 'all',                         label: '전체 사용처' },
  { value: 'charge',                      label: '충전' },
  { value: 'pdf_analysis',                label: '지문분석' },
  { value: 'mock_workbook',               label: '워크북' },
  { value: 'ai_question_per_type',        label: '실전변형 (직접)' },
  { value: 'mock_exam_question_per_type', label: '실전변형 (모의)' },
  { value: 'vocab_choice',                label: '어휘선택' },
  { value: 'sms',                         label: 'SMS / 키오스크 SMS' },
  { value: 'lms',                         label: 'LMS / 키오스크 LMS' },
];

function featureLabel(key: string | null) {
  if (!key) return { label: '충전', color: 'text-yellow-400' };
  return FEATURE_LABELS[key] ?? { label: key, color: 'text-slate-400' };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
}

export default function ConHistoryPage() {
  const [transactions, setTransactions] = useState<ConTx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ total_charge: 0, total_deduct: 0 });

  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());
  const [typeFilter, setTypeFilter] = useState('all');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(pageSize),
        type: typeFilter,
        feature_key: featureFilter,
        search,
      });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`/api/credits/con-history?${params.toString()}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? { total_charge: 0, total_deduct: 0 });
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, typeFilter, featureFilter, search, pageSize]);

  useEffect(() => { fetchData(1); }, [fetchData, pageSize]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleReset = () => {
    setStartDate(monthAgo());
    setEndDate(today());
    setTypeFilter('all');
    setFeatureFilter('all');
    setSearch('');
    setSearchInput('');
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">CON 사용 이력</h1>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-1 font-bold">총 {total.toLocaleString()}건</p>
      </div>

      {/* 필터 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        {/* 날짜 */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-black text-gray-500 dark:text-slate-400 w-14">기간</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm font-bold bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
          <span className="text-gray-400 font-bold text-sm">~</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm font-bold bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
          {/* 단축 버튼 */}
          {[
            { label: '오늘', fn: () => { setStartDate(today()); setEndDate(today()); } },
            { label: '1주일', fn: () => { const d = new Date(); d.setDate(d.getDate() - 7); setStartDate(d.toISOString().split('T')[0]); setEndDate(today()); } },
            { label: '1개월', fn: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); setStartDate(d.toISOString().split('T')[0]); setEndDate(today()); } },
            { label: '3개월', fn: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); setStartDate(d.toISOString().split('T')[0]); setEndDate(today()); } },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn}
              className="px-3 py-2 text-xs font-black bg-gray-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all border border-gray-200 dark:border-slate-700">
              {label}
            </button>
          ))}
        </div>

        {/* 유형 + 사용처 */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-black text-gray-500 dark:text-slate-400 w-14">유형</span>
          {[
            { value: 'all', label: '전체' },
            { value: 'charge', label: '충전' },
            { value: 'deduct', label: '차감' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-4 py-2 text-xs font-black rounded-xl border transition-all ${
                typeFilter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-indigo-400'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-black text-gray-500 dark:text-slate-400 w-14">사용처</span>
          <select
            value={featureFilter}
            onChange={e => setFeatureFilter(e.target.value)}
            className="px-3 py-2 text-sm font-bold bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500">
            {FEATURE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 내용 검색 */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-black text-gray-500 dark:text-slate-400 w-14">내용</span>
          <input
            type="text"
            placeholder="내용 검색..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="px-4 py-2 text-sm font-bold bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-64"
          />
          <button onClick={handleSearch}
            className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all">
            검색
          </button>
          <button onClick={handleReset}
            className="px-4 py-2 text-xs font-black bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300 rounded-xl transition-all">
            초기화
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-gray-400 dark:text-slate-500 mb-1">총 충전</p>
          <p className="text-2xl font-black text-yellow-500">+{summary.total_charge.toLocaleString()}<span className="text-sm ml-1">C</span></p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-gray-400 dark:text-slate-500 mb-1">총 차감</p>
          <p className="text-2xl font-black text-red-400">-{summary.total_deduct.toLocaleString()}<span className="text-sm ml-1">C</span></p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-black text-gray-400 dark:text-slate-500 mb-1">순 잔액 변동</p>
          <p className={`text-2xl font-black ${summary.total_charge - summary.total_deduct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.total_charge - summary.total_deduct >= 0 ? '+' : ''}{(summary.total_charge - summary.total_deduct).toLocaleString()}<span className="text-sm ml-1">C</span>
          </p>
        </div>
      </div>

      {/* 테이블 헤더: 건수 선택 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-gray-400 dark:text-slate-500">
          {total.toLocaleString()}건 중 {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()}번째
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-gray-400 dark:text-slate-500">페이지 당</span>
          {[20, 50, 100].map(n => (
            <button key={n}
              onClick={() => { setPageSize(n); }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg border transition-all ${
                pageSize === n
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-indigo-400'
              }`}>
              {n}건
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="text-3xl animate-pulse mb-3">⭐</div>
            <p className="text-sm font-bold text-gray-400 dark:text-slate-500">불러오는 중...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-3xl mb-3">📭</div>
            <p className="text-sm font-bold text-gray-400 dark:text-slate-500">이력이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-black text-gray-500 dark:text-slate-500">날짜</th>
                  <th className="py-3 px-4 text-center text-xs font-black text-gray-500 dark:text-slate-500">유형</th>
                  <th className="py-3 px-4 text-center text-xs font-black text-gray-500 dark:text-slate-500">사용처</th>
                  <th className="py-3 px-4 text-left text-xs font-black text-gray-500 dark:text-slate-500">내용</th>
                  <th className="py-3 px-4 text-right text-xs font-black text-gray-500 dark:text-slate-500">금액</th>
                  <th className="py-3 px-4 text-right text-xs font-black text-gray-500 dark:text-slate-500">잔액</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => {
                  const fl = tx.type === 'charge'
                    ? { label: '충전', color: 'text-yellow-400' }
                    : featureLabel(tx.feature_key);
                  return (
                    <tr key={tx.id} className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-xs font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black rounded-md ${
                          tx.type === 'charge'
                            ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50'
                            : 'bg-red-900/30 text-red-400 border border-red-800/50'
                        }`}>
                          {tx.type === 'charge' ? '충전' : '차감'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-black ${fl.color}`}>{fl.label}</span>
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-slate-300 max-w-[260px] truncate">
                        {tx.description || '-'}
                      </td>
                      <td className={`py-3 px-4 text-right text-sm font-black ${tx.type === 'charge' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {tx.type === 'charge' ? '+' : '-'}{tx.amount.toLocaleString()}C
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-black text-gray-700 dark:text-white">
                        {tx.balance_after.toLocaleString()}C
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchData(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 text-xs font-black bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:border-indigo-400 transition-all">
            ← 이전
          </button>
          <span className="text-xs font-black text-gray-500 dark:text-slate-400 px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => fetchData(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 text-xs font-black bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:border-indigo-400 transition-all">
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
