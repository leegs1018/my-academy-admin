'use client';

import { useState, useEffect, useMemo } from 'react';

interface Academy {
  user_id: string;
  academy_name: string;
  email: string;
  academy_phone: string;
  mobile: string;
  points: number;
  kiosk_code: string;
  referral_code: string;
  created_at: string;
  student_count: number;
  sms_count: number;
}

export default function AcademiesPage() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/superadmin/academies')
      .then(r => r.json())
      .then(d => { setAcademies(d.academies || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    academies.filter(a =>
      a.academy_name?.includes(search) ||
      a.email?.includes(search) ||
      a.academy_phone?.includes(search)
    ),
    [academies, search]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🏫</div>
          <p className="text-slate-400 font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">🏫 학원 관리</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">총 {academies.length}개 학원 가입</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="학원명 / 이메일 / 전화번호 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-900 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        <span className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-black text-slate-400">
          {filtered.length}개
        </span>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">학원명</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">이메일</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 hidden md:table-cell">전화번호</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">키오스크</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">잔여 콘</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">학생수</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">SMS</th>
                <th className="py-3 px-4 text-right text-xs font-black text-slate-500">가입일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const date = new Date(a.created_at);
                const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                return (
                  <tr key={a.user_id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-black text-white">{a.academy_name || '(미설정)'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-bold text-xs">{a.email}</td>
                    <td className="py-3 px-4 text-slate-400 font-bold text-xs hidden md:table-cell">
                      {a.academy_phone || a.mobile || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-slate-300 tracking-widest">
                      {a.kiosk_code || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-yellow-400">{(a.points || 0).toLocaleString()}</span>
                      <span className="text-xs text-slate-500 ml-0.5">C</span>
                    </td>
                    <td className="py-3 px-4 text-center font-black text-emerald-400">{a.student_count}</td>
                    <td className="py-3 px-4 text-center font-black text-indigo-400">{a.sms_count}</td>
                    <td className="py-3 px-4 text-right text-xs font-bold text-slate-500">{dateStr}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-slate-600 font-bold">검색 결과 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
