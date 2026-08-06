'use client';

import { useState } from 'react';

const MOCK_BILLS = [
  { id: '1', student: '김민준', class: '수능특강반', amount: 280000, status: '납부완료', due: '2026-08-05', paid: '2026-08-03' },
  { id: '2', student: '이서연', class: '내신대비반', amount: 320000, status: '미납',    due: '2026-08-10', paid: null },
  { id: '3', student: '박지훈', class: '수능특강반', amount: 280000, status: '납부완료', due: '2026-08-05', paid: '2026-08-05' },
  { id: '4', student: '최아영', class: '독해집중반', amount: 250000, status: '미납',    due: '2026-08-10', paid: null },
  { id: '5', student: '정우성', class: '내신대비반', amount: 320000, status: '납부완료', due: '2026-08-05', paid: '2026-08-01' },
];

const STATUS_STYLE: Record<string, string> = {
  납부완료: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  미납:     'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  부분납:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500',
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<'bills' | 'report'>('bills');
  const [statusFilter, setStatusFilter] = useState('전체');

  const filtered = statusFilter === '전체' ? MOCK_BILLS : MOCK_BILLS.filter(b => b.status === statusFilter);
  const totalAmount   = MOCK_BILLS.reduce((s, b) => s + b.amount, 0);
  const paidAmount    = MOCK_BILLS.filter(b => b.status === '납부완료').reduce((s, b) => s + b.amount, 0);
  const unpaidAmount  = MOCK_BILLS.filter(b => b.status === '미납').reduce((s, b) => s + b.amount, 0);
  const paidCount     = MOCK_BILLS.filter(b => b.status === '납부완료').length;
  const unpaidCount   = MOCK_BILLS.filter(b => b.status === '미납').length;

  return (
    <div className="space-y-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">청구·수납 관리</h1>
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              개발중
            </span>
          </div>
          <p className="text-sm font-bold text-gray-400">청구서 발행·수납 현황·매출 보고서를 한 곳에서 관리합니다.</p>
        </div>
        <button
          disabled
          className="px-4 py-2.5 text-sm font-black rounded-xl bg-indigo-600 text-white opacity-40 cursor-not-allowed"
        >
          + 청구서 발행
        </button>
      </div>

      {/* 연동 안내 배너 */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-5 py-4 flex items-start gap-3">
        <span className="text-xl mt-0.5">🔗</span>
        <div>
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">결제선생 API 연동 준비 중</p>
          <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 mt-0.5">
            현재 화면은 미리보기입니다. API 연동 완료 후 실제 청구·수납 데이터가 표시됩니다.
          </p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '이번달 청구액',  value: `${(totalAmount / 10000).toFixed(0)}만원`,  color: 'text-gray-900 dark:text-white' },
          { label: '수납 완료',      value: `${(paidAmount / 10000).toFixed(0)}만원`,   color: 'text-emerald-600 dark:text-emerald-400' },
          { label: '미수금',         value: `${(unpaidAmount / 10000).toFixed(0)}만원`, color: 'text-red-500 dark:text-red-400' },
          { label: '수납률',         value: `${Math.round((paidCount / MOCK_BILLS.length) * 100)}%`, color: 'text-indigo-600 dark:text-indigo-400' },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
            <p className="text-xs font-black text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(['bills', 'report'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-black rounded-lg transition-all ${
              tab === t
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'bills' ? '청구서 목록' : '매출 보고서'}
          </button>
        ))}
      </div>

      {tab === 'bills' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* 필터 */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">
            {['전체', '납부완료', '미납', '부분납'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s}
                {s === '미납' && unpaidCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5">{unpaidCount}</span>
                )}
              </button>
            ))}
            <span className="ml-auto text-xs font-bold text-gray-400">{filtered.length}건</span>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['학생명', '클래스', '청구금액', '납부기한', '납부일', '상태', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-black text-gray-900 dark:text-white">{b.student}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 dark:text-gray-400">{b.class}</td>
                    <td className="px-5 py-3.5 font-black text-gray-900 dark:text-white">{b.amount.toLocaleString()}원</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 dark:text-gray-400">{b.due}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 dark:text-gray-400">{b.paid ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 text-xs font-black rounded-lg ${STATUS_STYLE[b.status]}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button disabled className="px-3 py-1.5 text-xs font-black rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed opacity-50">
                        청구서 보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-4">
          {/* 월별 매출 차트 자리 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <p className="text-sm font-black text-gray-900 dark:text-white mb-4">월별 매출</p>
            <div className="flex items-end gap-3 h-36">
              {[
                { month: '3월', amount: 42 },
                { month: '4월', amount: 58 },
                { month: '5월', amount: 51 },
                { month: '6월', amount: 67 },
                { month: '7월', amount: 73 },
                { month: '8월', amount: 45 },
              ].map(d => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-gray-400">{d.amount}만</span>
                  <div
                    className="w-full rounded-t-lg bg-indigo-500 dark:bg-indigo-600 opacity-70"
                    style={{ height: `${(d.amount / 80) * 100}%` }}
                  />
                  <span className="text-[10px] font-bold text-gray-400">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 클래스별 수납 현황 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-black text-gray-900 dark:text-white">클래스별 수납 현황</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['클래스명', '수강생', '청구액', '수납액', '미수금', '수납률'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: '수능특강반',  students: 12, billed: 336, paid: 308, unpaid: 28 },
                  { name: '내신대비반',  students: 8,  billed: 256, paid: 192, unpaid: 64 },
                  { name: '독해집중반',  students: 5,  billed: 125, paid: 125, unpaid: 0  },
                ].map(c => (
                  <tr key={c.name} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="px-5 py-3.5 font-black text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500">{c.students}명</td>
                    <td className="px-5 py-3.5 font-bold text-gray-700 dark:text-gray-300">{c.billed}만원</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">{c.paid}만원</td>
                    <td className="px-5 py-3.5 font-bold text-red-500">{c.unpaid > 0 ? `${c.unpaid}만원` : '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 max-w-20">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${Math.round((c.paid / c.billed) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                          {Math.round((c.paid / c.billed) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
