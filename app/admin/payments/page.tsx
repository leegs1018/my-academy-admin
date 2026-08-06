'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ── 목업 데이터 ──────────────────────────────────────────
const CLASSES = ['수능특강반', '내신대비반', '독해집중반', '어휘특강반'];
const CLASS_COLORS: Record<string, string> = {
  '수능특강반': '#6366f1',
  '내신대비반': '#8b5cf6',
  '독해집중반': '#06b6d4',
  '어휘특강반': '#10b981',
};

// 연도·클래스별 월 데이터 (목업)
const RAW_DATA: Record<number, Record<string, number[]>> = {
  2024: {
    '수능특강반': [2400000,2400000,2800000,2800000,2800000,3200000,3200000,3200000,3200000,2800000,2800000,2400000],
    '내신대비반': [1600000,1600000,1920000,1920000,1920000,2240000,2240000,2240000,2240000,1920000,1920000,1600000],
    '독해집중반': [750000, 750000, 1000000,1000000,1000000,1000000,1250000,1250000,1250000,1000000,1000000,750000],
    '어휘특강반': [540000, 540000, 720000, 720000, 720000, 900000, 900000, 900000, 900000, 720000, 720000, 540000],
  },
  2025: {
    '수능특강반': [2800000,2800000,3080000,3360000,3360000,3360000,3640000,3640000,3640000,3360000,3080000,2800000],
    '내신대비반': [1920000,1920000,2240000,2560000,2560000,2560000,2880000,2880000,2880000,2560000,2240000,1920000],
    '독해집중반': [1000000,1000000,1250000,1250000,1250000,1500000,1500000,1500000,1500000,1250000,1250000,1000000],
    '어휘특강반': [720000, 720000, 900000, 900000, 900000, 900000, 1080000,1080000,1080000,900000, 900000, 720000],
  },
  2026: {
    '수능특강반': [3080000,2800000,3360000,3920000,3640000,4480000,4760000,3080000,0,0,0,0],
    '내신대비반': [1920000,1600000,1920000,1920000,1920000,1920000,2240000,1920000,0,0,0,0],
    '독해집중반': [1000000,1000000,1000000,1000000,1000000,1000000,1250000,1000000,0,0,0,0],
    '어휘특강반': [540000, 540000, 720000, 720000, 720000, 720000, 900000, 540000, 0,0,0,0],
  },
};

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 8; // 1-indexed

const BILLS = [
  { id:'1', student:'김민준', class:'수능특강반', amount:280000, status:'납부완료', due:'2026-08-05', paid:'2026-08-03', payments:[280000,280000,280000,280000,280000,280000,280000,280000,0,0,0,0] },
  { id:'2', student:'이서연', class:'내신대비반', amount:320000, status:'미납',    due:'2026-08-10', paid:null,         payments:[320000,320000,320000,320000,320000,320000,320000,0,0,0,0,0] },
  { id:'3', student:'박지훈', class:'수능특강반', amount:280000, status:'납부완료', due:'2026-08-05', paid:'2026-08-05', payments:[280000,280000,280000,280000,280000,280000,280000,280000,0,0,0,0] },
  { id:'4', student:'최아영', class:'독해집중반', amount:250000, status:'미납',    due:'2026-08-10', paid:null,         payments:[250000,250000,250000,250000,250000,250000,250000,0,0,0,0,0] },
  { id:'5', student:'정우성', class:'내신대비반', amount:320000, status:'납부완료', due:'2026-08-05', paid:'2026-08-01', payments:[320000,320000,320000,320000,320000,320000,320000,320000,0,0,0,0] },
  { id:'6', student:'한지민', class:'어휘특강반', amount:180000, status:'납부완료', due:'2026-08-05', paid:'2026-08-02', payments:[180000,180000,180000,180000,180000,180000,180000,180000,0,0,0,0] },
  { id:'7', student:'오준혁', class:'수능특강반', amount:280000, status:'부분납',  due:'2026-08-10', paid:null,         payments:[280000,280000,280000,280000,280000,280000,150000,0,0,0,0,0] },
];

const STATUS_STYLE: Record<string, string> = {
  납부완료: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  미납:     'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  부분납:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-500',
};

const PERIOD_OPTIONS = [
  { label: '전체', value: 'all' },
  { label: '최근 3개월', value: '3m' },
  { label: '최근 6개월', value: '6m' },
  { label: '직접 입력', value: 'custom' },
];

function fmt(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}천만`;
  if (n >= 1000000)  return `${(n / 1000000).toFixed(1)}백만`;
  if (n >= 10000)    return `${Math.round(n / 10000)}만`;
  return `${n.toLocaleString()}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-black text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value.toLocaleString()}원
        </p>
      ))}
    </div>
  );
};
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-black text-white">{payload[0].name}</p>
      <p className="font-bold text-gray-300">{payload[0].value.toLocaleString()}원</p>
    </div>
  );
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<'overview' | 'bills' | 'student'>('overview');

  // 보고서 필터 상태
  const [filterYear,   setFilterYear]   = useState<number>(CURRENT_YEAR);
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterClass,  setFilterClass]  = useState<string>('전체');
  const [customFrom,   setCustomFrom]   = useState<number>(1);
  const [customTo,     setCustomTo]     = useState<number>(CURRENT_MONTH);

  // 청구서 필터
  const [statusFilter, setStatusFilter] = useState('전체');
  const [search,       setSearch]       = useState('');

  // 학생 검색
  const [studentSearch,   setStudentSearch]   = useState('');
  const [selectedStudent, setSelectedStudent] = useState<typeof BILLS[0] | null>(null);

  // ── 보고서 계산 ─────────────────────────────────────────
  const visibleMonthIndices = useMemo(() => {
    const maxIdx = filterYear === CURRENT_YEAR ? CURRENT_MONTH - 1 : 11;
    if (filterPeriod === '3m') {
      const end = maxIdx; const start = Math.max(0, end - 2);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    if (filterPeriod === '6m') {
      const end = maxIdx; const start = Math.max(0, end - 5);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    if (filterPeriod === 'custom') {
      const s = customFrom - 1; const e = Math.min(customTo - 1, maxIdx);
      return Array.from({ length: e - s + 1 }, (_, i) => s + i);
    }
    return Array.from({ length: maxIdx + 1 }, (_, i) => i);
  }, [filterYear, filterPeriod, customFrom, customTo]);

  const activeClasses = filterClass === '전체' ? CLASSES : [filterClass];

  const chartData = useMemo(() => {
    const yearData = RAW_DATA[filterYear] ?? {};
    return visibleMonthIndices.map(idx => {
      const row: Record<string, any> = { month: MONTHS[idx] };
      let total청 = 0; let total수 = 0;
      activeClasses.forEach(cls => {
        const v = yearData[cls]?.[idx] ?? 0;
        row[cls] = v;
        total청 += Math.round(v * 1.05);
        total수 += v;
      });
      row['청구액'] = total청;
      row['수납액'] = total수;
      return row;
    });
  }, [filterYear, visibleMonthIndices, activeClasses]);

  const pieData = useMemo(() => {
    const yearData = RAW_DATA[filterYear] ?? {};
    return activeClasses.map(cls => ({
      name: cls,
      value: visibleMonthIndices.reduce((s, i) => s + (yearData[cls]?.[i] ?? 0), 0),
      color: CLASS_COLORS[cls],
    })).filter(d => d.value > 0);
  }, [filterYear, visibleMonthIndices, activeClasses]);

  const totalPaidSum   = chartData.reduce((s, r) => s + (r['수납액'] ?? 0), 0);
  const totalBilledSum = chartData.reduce((s, r) => s + (r['청구액'] ?? 0), 0);
  const avgPerMonth    = chartData.length > 0 ? Math.round(totalPaidSum / chartData.length) : 0;

  const classBarData = useMemo(() => {
    const yearData = RAW_DATA[filterYear] ?? {};
    return activeClasses.map(cls => ({
      name: cls,
      수납액: visibleMonthIndices.reduce((s, i) => s + (yearData[cls]?.[i] ?? 0), 0),
      color: CLASS_COLORS[cls],
    })).filter(d => d.수납액 > 0);
  }, [filterYear, visibleMonthIndices, activeClasses]);

  // 청구서 필터
  const filteredBills = useMemo(() => {
    let list = BILLS;
    if (statusFilter !== '전체') list = list.filter(b => b.status === statusFilter);
    if (search.trim()) list = list.filter(b => b.student.includes(search.trim()));
    return list;
  }, [statusFilter, search]);

  const filteredStudents = useMemo(() =>
    !studentSearch.trim() ? BILLS : BILLS.filter(b => b.student.includes(studentSearch.trim()))
  , [studentSearch]);

  const studentYearTotal = selectedStudent?.payments.reduce((s, v) => s + v, 0) ?? 0;
  const studentChartData = selectedStudent
    ? MONTHS.map((m, i) => ({ month: m, 수납액: selectedStudent.payments[i] })) : [];

  const totalBilled  = BILLS.reduce((s, b) => s + b.amount, 0);
  const totalPaid    = BILLS.filter(b => b.status === '납부완료').reduce((s, b) => s + b.amount, 0);
  const totalUnpaid  = BILLS.filter(b => b.status === '미납').reduce((s, b) => s + b.amount, 0);
  const collectRate  = Math.round((BILLS.filter(b=>b.status==='납부완료').length / BILLS.length) * 100);

  const filterLabel = useMemo(() => {
    const yearStr = `${filterYear}년`;
    const classStr = filterClass === '전체' ? '' : ` · ${filterClass}`;
    if (filterPeriod === '3m') return `${yearStr} 최근 3개월${classStr}`;
    if (filterPeriod === '6m') return `${yearStr} 최근 6개월${classStr}`;
    if (filterPeriod === 'custom') return `${yearStr} ${customFrom}월~${customTo}월${classStr}`;
    return `${yearStr} 전체${classStr}`;
  }, [filterYear, filterPeriod, filterClass, customFrom, customTo]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">청구·수납 관리</h1>
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">개발중</span>
          </div>
          <p className="text-sm font-bold text-gray-400">결제선생 API 연동 완료 후 실제 데이터가 표시됩니다.</p>
        </div>
        <button disabled className="px-4 py-2.5 text-sm font-black rounded-xl bg-indigo-600 text-white opacity-40 cursor-not-allowed">
          + 청구서 발행
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'이번달 청구액', value:fmt(totalBilled),  sub:`${BILLS.length}건`,                                  icon:'📋', grad:'from-indigo-500 to-indigo-600' },
          { label:'수납 완료',     value:fmt(totalPaid),    sub:`${BILLS.filter(b=>b.status==='납부완료').length}건`,  icon:'✅', grad:'from-emerald-500 to-emerald-600' },
          { label:'미수금',        value:fmt(totalUnpaid),  sub:`${BILLS.filter(b=>b.status==='미납').length}건 미납`, icon:'⚠️', grad:'from-red-500 to-red-600' },
          { label:'수납률',        value:`${collectRate}%`, sub:'이번달',                                             icon:'📊', grad:'from-violet-500 to-violet-600' },
        ].map(c => (
          <div key={c.label} className="relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-3xl bg-gradient-to-br ${c.grad} opacity-10`} />
            <p className="text-xs font-black text-gray-400 mb-1">{c.label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mb-1">{c.value}</p>
            <p className="text-xs font-bold text-gray-400">{c.sub}</p>
            <span className="absolute top-4 right-4 text-xl opacity-60">{c.icon}</span>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
        {([['overview','매출 보고서'], ['bills','청구서 목록'], ['student','학생별 수납 이력']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-black rounded-lg transition-all ${
              tab === t ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                       : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 매출 보고서 ── */}
      {tab === 'overview' && (
        <div className="space-y-5">

          {/* 필터 바 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 space-y-3">
            <div className="flex flex-wrap gap-4 items-start">

              {/* 연도 */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">연도</p>
                <div className="flex gap-1">
                  {[2024, 2025, 2026].map(y => (
                    <button key={y} onClick={() => setFilterYear(y)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                        filterYear === y ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}>
                      {y}년
                    </button>
                  ))}
                </div>
              </div>

              {/* 기간 */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">기간</p>
                <div className="flex gap-1 flex-wrap">
                  {PERIOD_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setFilterPeriod(opt.value)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                        filterPeriod === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {filterPeriod === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <select value={customFrom} onChange={e => setCustomFrom(Number(e.target.value))}
                      className="px-2 py-1.5 text-xs font-black rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-indigo-400">
                      {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                    </select>
                    <span className="text-xs font-bold text-gray-400">~</span>
                    <select value={customTo} onChange={e => setCustomTo(Number(e.target.value))}
                      className="px-2 py-1.5 text-xs font-black rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-indigo-400">
                      {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* 클래스 */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">클래스</p>
                <div className="flex gap-1 flex-wrap">
                  {['전체', ...CLASSES].map(cls => (
                    <button key={cls} onClick={() => setFilterClass(cls)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                        filterClass === cls
                          ? cls === '전체' ? 'bg-indigo-600 text-white'
                            : 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      style={filterClass === cls && cls !== '전체' ? { background: CLASS_COLORS[cls] } : {}}>
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 적용된 필터 요약 */}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">적용 필터</span>
              <span className="px-2.5 py-1 text-xs font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg">
                {filterLabel}
              </span>
              <span className="text-xs font-bold text-gray-400">{chartData.length}개월 데이터</span>
            </div>
          </div>

          {/* 연간 요약 배너 */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-bold text-indigo-200 mb-1">{filterLabel} 수납액</p>
              <p className="text-4xl font-black">{totalPaidSum.toLocaleString()}원</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs font-bold text-indigo-200">청구 합계</p>
                <p className="text-xl font-black">{fmt(totalBilledSum)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-200">월 평균</p>
                <p className="text-xl font-black">{fmt(avgPerMonth)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-200">기간</p>
                <p className="text-xl font-black">{chartData.length}개월</p>
              </div>
            </div>
          </div>

          {/* 월별 수납 추이 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div>
                <p className="text-base font-black text-gray-900 dark:text-white">월별 청구·수납 추이</p>
                <p className="text-xs font-bold text-gray-400 mt-0.5">{filterLabel}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />청구액</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />수납액</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v === 0 ? '0' : `${v/10000}만`} tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="청구액" stroke="#6366f1" strokeWidth={2.5} fill="url(#gBilled)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="수납액" stroke="#10b981" strokeWidth={2.5} fill="url(#gPaid)"   dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 클래스별 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 파이 차트 */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
              <p className="text-base font-black text-gray-900 dark:text-white mb-1">클래스별 수납 비중</p>
              <p className="text-xs font-bold text-gray-400 mb-4">{filterLabel}</p>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={3}>
                        {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {pieData.map(c => (
                      <div key={c.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{c.name}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900 dark:text-white">{c.value.toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-sm font-bold text-gray-400">데이터 없음</div>
              )}
            </div>

            {/* 클래스별 바 차트 */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
              <p className="text-base font-black text-gray-900 dark:text-white mb-1">클래스별 수납 합계</p>
              <p className="text-xs font-bold text-gray-400 mb-4">{filterLabel}</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classBarData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v/10000}만`} tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="수납액" radius={[6,6,0,0]}>
                    {classBarData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── 청구서 목록 ── */}
      {tab === 'bills' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="학생 이름 검색..."
              className="px-3 py-2 text-sm font-bold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-400 w-44" />
            <div className="flex gap-1.5 flex-wrap">
              {['전체','납부완료','미납','부분납'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {s}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs font-bold text-gray-400">{filteredBills.length}건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {['학생명','클래스','청구금액','납부기한','납부일','상태',''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBills.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-black text-gray-900 dark:text-white">{b.student}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 dark:text-gray-400">{b.class}</td>
                    <td className="px-5 py-3.5 font-black text-gray-900 dark:text-white">{b.amount.toLocaleString()}원</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 dark:text-gray-400">{b.due}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 dark:text-gray-400">{b.paid ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 text-xs font-black rounded-lg ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button disabled className="px-3 py-1.5 text-xs font-black rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed opacity-50">상세</button>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm font-bold text-gray-400">검색 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 학생별 수납 이력 ── */}
      {tab === 'student' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <p className="text-sm font-black text-gray-700 dark:text-gray-300 mb-3">학생 검색</p>
            <input value={studentSearch} onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null); }} placeholder="학생 이름을 입력하세요..."
              className="w-full px-4 py-3 text-sm font-bold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-400" />
            {studentSearch && (
              <div className="mt-2 space-y-1">
                {filteredStudents.map(s => (
                  <button key={s.id} onClick={() => setSelectedStudent(s)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      selectedStudent?.id === s.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                    {s.student} <span className="text-gray-400 font-normal">· {s.class}</span>
                  </button>
                ))}
                {filteredStudents.length === 0 && <p className="text-sm font-bold text-gray-400 px-4 py-2">검색 결과 없음</p>}
              </div>
            )}
          </div>

          {selectedStudent && (
            <>
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-indigo-200 mb-1">{selectedStudent.class}</p>
                  <p className="text-2xl font-black">{selectedStudent.student}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-indigo-200">2026년 연간 수납액</p>
                  <p className="text-3xl font-black">{studentYearTotal.toLocaleString()}원</p>
                  <p className="text-xs font-bold text-indigo-200 mt-1">월 평균 {fmt(Math.round(studentYearTotal / 8))}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
                <p className="text-base font-black text-gray-900 dark:text-white mb-6">월별 수납 현황 (2026년)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={studentChartData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => v === 0 ? '0' : `${v/10000}만`} tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="수납액" radius={[6,6,0,0]}>
                      {studentChartData.map((entry, i) => <Cell key={i} fill={entry.수납액 > 0 ? '#6366f1' : '#e5e7eb'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-black text-gray-900 dark:text-white">월별 수납 상세</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      {['월','수납액','상태'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-black text-gray-400">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((m, i) => {
                      const amount = selectedStudent.payments[i];
                      const isPast = i < CURRENT_MONTH;
                      const status = !isPast ? '—' : amount > 0 ? '납부완료' : '미납';
                      return (
                        <tr key={m} className={`border-b border-gray-50 dark:border-gray-800/50 ${!isPast ? 'opacity-40' : ''}`}>
                          <td className="px-5 py-3 font-black text-gray-700 dark:text-gray-300">{m}</td>
                          <td className="px-5 py-3 font-black text-gray-900 dark:text-white">{amount > 0 ? `${amount.toLocaleString()}원` : isPast ? '0원' : '—'}</td>
                          <td className="px-5 py-3">
                            {status !== '—'
                              ? <span className={`px-2.5 py-1 text-xs font-black rounded-lg ${STATUS_STYLE[status] ?? ''}`}>{status}</span>
                              : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-5 py-3 font-black text-gray-900 dark:text-white">합계</td>
                      <td className="px-5 py-3 font-black text-indigo-600 dark:text-indigo-400">{studentYearTotal.toLocaleString()}원</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {!selectedStudent && !studentSearch && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-16 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm font-black text-gray-500">위에서 학생 이름을 검색해주세요</p>
              <p className="text-xs font-bold text-gray-400 mt-1">이름 입력 시 연간 수납 이력을 확인할 수 있습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
