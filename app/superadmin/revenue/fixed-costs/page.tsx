'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface FixedCost {
  id: string;
  type: 'revenue' | 'expense';
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  repeat_cycle: 'weekly' | 'monthly' | 'once';
  currency: 'KRW' | 'USD';
  amount: number;
  payment_method: string | null;
  created_at: string;
}

const CYCLE_LABEL: Record<FixedCost['repeat_cycle'], string> = { weekly: '매주', monthly: '매월', once: '단건' };

export default function FixedCostsPage() {
  const [items, setItems] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<'revenue' | 'expense'>('expense');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [repeatCycle, setRepeatCycle] = useState<'weekly' | 'monthly' | 'once'>('monthly');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [cycleFilter, setCycleFilter] = useState<'all' | 'once' | 'weekly' | 'monthly'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/fixed-costs');
      const data = await res.json();
      setItems(data.fixedCosts || []);
    } catch {
      setError('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = cycleFilter === 'all' ? items : items.filter(i => i.repeat_cycle === cycleFilter);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredItems.length, page]);

  useEffect(() => { setPage(1); }, [cycleFilter]);

  function resetForm() {
    setType('expense'); setTitle(''); setDescription(''); setStartDate(''); setEndDate('');
    setRepeatCycle('monthly'); setCurrency('KRW'); setAmount(''); setPaymentMethod('');
    setEditingId(null);
  }

  function startEdit(it: FixedCost) {
    setEditingId(it.id);
    setType(it.type);
    setTitle(it.title);
    setDescription(it.description || '');
    setStartDate(it.start_date);
    setEndDate(it.end_date || '');
    setRepeatCycle(it.repeat_cycle);
    setCurrency(it.currency);
    setAmount(String(it.amount));
    setPaymentMethod(it.payment_method || '');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    setError('');
    if (!title.trim() || !startDate || !amount || Number(amount) <= 0) {
      setError('제목, 시작일, 금액을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/fixed-costs', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          type, title, description, start_date: startDate,
          end_date: repeatCycle === 'once' ? null : (endDate || null),
          repeat_cycle: repeatCycle, currency, amount: Number(amount),
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (editingId ? '수정에 실패했습니다.' : '등록에 실패했습니다.'));
      resetForm();
      setPage(1);
      await fetchItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 고정비 등록을 삭제할까요? 이미 집계된 매출 분석 내역에도 더 이상 반영되지 않습니다.')) return;
    try {
      const res = await fetch(`/api/superadmin/fixed-costs?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제에 실패했습니다.');
      setItems(prev => prev.filter(i => i.id !== id));
      if (editingId === id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin/revenue" className="text-xs font-black text-slate-500 hover:text-slate-300">← 매출 분석으로</Link>
        <h1 className="text-3xl font-black text-white mt-2">⚙️ 고정비 / 단건 거래 관리</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">
          서버 유지비처럼 주기적으로 반복되는 고정 매출/매입이나, 한 번만 발생하는 단건 매출/매입을 등록하면 매출 분석 리스트에 자동으로 반영됩니다.
          달러(USD) 금액은 해당 발생일의 환율로 자동 환산됩니다.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white">{editingId ? '고정비/단건 수정' : '새 고정비/단건 등록'}</h2>
          {editingId && (
            <button onClick={resetForm} className="text-xs font-black text-slate-400 hover:text-slate-200">취소</button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">구분</label>
            <div className="flex gap-2">
              <button onClick={() => setType('revenue')}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl border transition-all ${type === 'revenue' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                매출
              </button>
              <button onClick={() => setType('expense')}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl border transition-all ${type === 'expense' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                매입 (지출)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">반복</label>
            <div className="flex gap-2">
              <button onClick={() => setRepeatCycle('once')}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl border transition-all ${repeatCycle === 'once' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                단건
              </button>
              <button onClick={() => setRepeatCycle('weekly')}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl border transition-all ${repeatCycle === 'weekly' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                매주
              </button>
              <button onClick={() => setRepeatCycle('monthly')}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl border transition-all ${repeatCycle === 'monthly' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                매월
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">제목</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: Vercel 서버 유지비"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">내용 (선택)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="예: Vercel Pro 플랜 매월 자동 결제"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">{repeatCycle === 'once' ? '날짜' : '시작일'}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          {repeatCycle !== 'once' && (
            <div>
              <label className="block text-xs font-black text-slate-400 mb-1.5">마감일 (비우면 계속 반복)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none" />
            </div>
          )}
          <div>
            <label className="block text-xs font-black text-slate-400 mb-1.5">금액</label>
            <div className="flex gap-2">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" />
              <select value={currency} onChange={e => setCurrency(e.target.value as 'KRW' | 'USD')}
                className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:border-indigo-500 focus:outline-none">
                <option value="KRW">원화</option>
                <option value="USD">달러</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 mb-1.5">결제수단 (선택)</label>
          <input type="text" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="예: 법인카드, 계좌이체, PayPal"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" />
        </div>

        {error && <p className="text-xs font-bold text-red-400">⚠️ {error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3 text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50">
          {submitting ? (editingId ? '수정 중...' : '등록 중...') : (editingId ? '수정 완료' : '+ 고정비 등록')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all', label: '전체' },
          { key: 'once', label: '단건' },
          { key: 'weekly', label: '매주 반복' },
          { key: 'monthly', label: '매월 반복' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setCycleFilter(key)}
            className={`px-3 py-1.5 text-xs font-black rounded-lg border transition-all ${cycleFilter === key ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <span className="text-sm font-black text-white">등록된 고정비 {filteredItems.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500 whitespace-nowrap">구분</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">제목</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">내용</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500 whitespace-nowrap">반복/기간</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 whitespace-nowrap">결제수단</th>
                <th className="py-3 px-4 text-right text-xs font-black text-slate-500 whitespace-nowrap">금액</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice((page - 1) * pageSize, page * pageSize).map(it => (
                <tr key={it.id} className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${it.type === 'revenue' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-sky-900/50 text-sky-400'}`}>
                      {it.type === 'revenue' ? '매출' : '매입'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-black text-white text-xs whitespace-nowrap">{it.title}</td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-300">{it.description || '-'}</td>
                  <td className="py-3 px-4 text-center text-xs font-bold text-slate-400 whitespace-nowrap">
                    {it.repeat_cycle === 'once'
                      ? `${CYCLE_LABEL[it.repeat_cycle]} · ${it.start_date}`
                      : `${CYCLE_LABEL[it.repeat_cycle]} · ${it.start_date} ~ ${it.end_date || '계속'}`}
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-300 whitespace-nowrap">{it.payment_method || '-'}</td>
                  <td className="py-3 px-4 text-right font-black text-white whitespace-nowrap">
                    {it.currency === 'USD' ? `$${it.amount.toLocaleString()}` : `${it.amount.toLocaleString()}원`}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(it)} className="text-xs font-black text-slate-400 hover:text-slate-200 mr-3">수정</button>
                    <button onClick={() => handleDelete(it.id)} className="text-xs font-black text-red-400 hover:text-red-300">삭제</button>
                  </td>
                </tr>
              ))}
              {!loading && filteredItems.length === 0 && (
                <tr><td colSpan={7} className="py-16 text-center text-slate-600 font-bold">등록된 고정비가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredItems.length > pageSize && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all disabled:opacity-30"
            >
              이전
            </button>
            <span className="text-xs font-bold text-slate-400">{page} / {Math.ceil(filteredItems.length / pageSize)}</span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(filteredItems.length / pageSize), p + 1))}
              disabled={page >= Math.ceil(filteredItems.length / pageSize)}
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
