'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Analytics {
  totalAcademies: number;
  totalStudents: number;
  totalSms: number;
  thisMonthNewAcademies: number;
  todayVisitors: number;
  todayConUsage: number;
  todayConCharge: number;
  monthlyData: { month: string; count: number }[];
  weeklyData: { week: string; count: number; range: string }[];
  top5: { academy_id: string; academy_name: string; student_count: number }[];
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/superadmin/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <p className="text-slate-400 font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: '가입 학원 수', value: data?.totalAcademies ?? 0, unit: '개', icon: '🏫', color: 'text-indigo-400' },
    { label: '총 학생 수', value: data?.totalStudents ?? 0, unit: '명', icon: '👤', color: 'text-emerald-400' },
    { label: '총 SMS 발송', value: data?.totalSms ?? 0, unit: '건', icon: '📱', color: 'text-yellow-400' },
    { label: '이번달 신규 가입', value: data?.thisMonthNewAcademies ?? 0, unit: '개', icon: '✨', color: 'text-pink-400' },
  ];

  const todayStats = [
    { label: '오늘 방문자', value: data?.todayVisitors ?? 0, unit: '명', icon: '👥', color: 'text-sky-400', bg: 'from-sky-500/10 to-sky-600/5', border: 'border-sky-500/20' },
    { label: '오늘 CON 사용량', value: data?.todayConUsage ?? 0, unit: 'CON', icon: '⚡', color: 'text-amber-400', bg: 'from-amber-500/10 to-amber-600/5', border: 'border-amber-500/20' },
    { label: '오늘 CON 충전량', value: data?.todayConCharge ?? 0, unit: 'CON', icon: '💳', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-600/5', border: 'border-emerald-500/20' },
  ];

  const todayDateStr = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">📊 데이터 분석</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">CON EDU 플랫폼 전체 현황</p>
      </div>

      {/* 오늘 TODAY 섹션 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full animate-pulse">● LIVE</span>
          <span className="text-sm font-black text-slate-400">TODAY — {todayDateStr}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {todayStats.map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-5 border ${s.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">TODAY</span>
              </div>
              <p className={`text-3xl font-black ${s.color}`}>
                {s.value.toLocaleString()}<span className="text-base ml-1 text-slate-500">{s.unit}</span>
              </p>
              <p className="text-xs font-black text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 전체 KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
            <div className="text-2xl mb-3">{kpi.icon}</div>
            <p className={`text-3xl font-black ${kpi.color}`}>
              {kpi.value.toLocaleString()}<span className="text-lg ml-1 text-slate-500">{kpi.unit}</span>
            </p>
            <p className="text-sm font-bold text-slate-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 주차별 가입 차트 */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white">이번 달 주차별 학원 가입 현황</h2>
          <span className="text-xs font-black text-slate-600">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data?.weeklyData ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="week"
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff', fontWeight: 700 }}
              formatter={(val, _name, props) => [`${val}개`, `${props.payload?.range ?? ''} 가입`]}
            />
            <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={64} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 flex-wrap">
          {(data?.weeklyData ?? []).map(w => (
            <div key={w.week} className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
              <span>{w.week}</span>
              <span className="text-slate-600">({w.range})</span>
              <span className="text-indigo-400 font-black">{w.count}개</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top5 학원 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-black text-white">학생 수 Top 5 학원</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="py-3 px-6 text-left text-xs font-black text-slate-500">순위</th>
              <th className="py-3 px-4 text-left text-xs font-black text-slate-500">학원명</th>
              <th className="py-3 px-4 text-right text-xs font-black text-slate-500">학생 수</th>
            </tr>
          </thead>
          <tbody>
            {(data?.top5 ?? []).map((a, i) => (
              <tr key={a.academy_id} className="border-t border-slate-800">
                <td className="py-3 px-6">
                  <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-400' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="py-3 px-4 font-black text-white">{a.academy_name}</td>
                <td className="py-3 px-4 text-right font-black text-emerald-400">{a.student_count}명</td>
              </tr>
            ))}
            {(data?.top5?.length ?? 0) === 0 && (
              <tr><td colSpan={3} className="py-10 text-center text-slate-600 font-bold">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
