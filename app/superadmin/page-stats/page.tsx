'use client';

import { useState, useEffect } from 'react';

interface FunnelStep {
  step: string;
  users: number;
  conversionFromPrev: number | null;
}

interface CoreMetrics {
  eligibleCohortSize: number;
  firstGenerationRate: number | null;
  medianTimeToFirstGenMinutes: number | null;
  reuseRate: number | null;
  reuseSampleSize: number;
  paidConversionRate: number | null;
  paidConversionSampleSize: number;
}

interface FunnelStats {
  cohortDays: number;
  totalEvents: number;
  cohortSize: number;
  funnel: FunnelStep[];
  generationFailedUsers: number;
  onboardingChoices: Record<string, number>;
  pageViewCounts: Record<string, number>;
  coreMetrics: CoreMetrics;
}

const STEP_LABELS: Record<string, string> = {
  signup_completed: '가입 완료',
  onboarding_viewed: '선택 화면 노출',
  onboarding_selected: '기능 선택',
  ai_page_viewed: 'AI 도구 진입',
  passage_entered: '지문 준비',
  generation_clicked: '생성 클릭',
  generation_completed: '생성 완료',
};

const PAGE_LABELS: Record<string, string> = {
  'pdf-editor': '지문분석',
  'vocab-choice': '워크북',
  'ai-questions': '실전변형',
};

const CHOICE_LABELS: Record<string, string> = {
  ai: 'AI 영어 문제 생성',
  dashboard: '학원관리 시작하기',
  unknown: '(기록 없음)',
};

function formatMinutes(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min}분`;
  if (min < 1440) return `${Math.round(min / 60 * 10) / 10}시간`;
  return `${Math.round(min / 1440 * 10) / 10}일`;
}

export default function PageStatsPage() {
  const [data, setData] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cohortDays, setCohortDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/superadmin/funnel-stats?days=${cohortDays}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cohortDays]);

  const maxUsers = Math.max(1, ...(data?.funnel.map(f => f.users) ?? [1]));
  const totalPageViews = Object.values(data?.pageViewCounts ?? {}).reduce((a, b) => a + b, 0);
  const totalChoices = Object.values(data?.onboardingChoices ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">📉 페이지 통계</h1>
          <p className="text-sm text-slate-500 mt-1 font-bold">가입 → 선택 → AI 체험 → 생성까지, 어디서 이탈하는지 확인합니다</p>
        </div>
        <select value={cohortDays} onChange={e => setCohortDays(Number(e.target.value))}
          className="text-xs font-black px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none">
          <option value={1}>가입 후 1일 이내</option>
          <option value={3}>가입 후 3일 이내</option>
          <option value={7}>가입 후 7일 이내</option>
          <option value={30}>가입 후 30일 이내</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">📉</div>
            <p className="text-slate-400 font-bold">데이터 불러오는 중...</p>
          </div>
        </div>
      ) : !data || data.totalEvents === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-slate-400 font-bold">기록된 이벤트가 없습니다.</p>
          <p className="text-xs text-slate-600 font-bold mt-2">
            <code className="text-yellow-400">supabase-onboarding-events-migration.sql</code>을 아직 실행하지 않았다면 먼저 실행해주세요.
          </p>
        </div>
      ) : (
        <>
          {/* 핵심 지표 4가지 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">가입 후 {data.cohortDays}일 내 첫 생성 완료율</p>
              <p className="text-2xl font-black text-white">{data.coreMetrics.firstGenerationRate !== null ? `${data.coreMetrics.firstGenerationRate}%` : '—'}</p>
              <p className="text-[10px] text-slate-600 font-bold mt-1">관찰 기간이 지난 가입자 {data.coreMetrics.eligibleCohortSize}명 기준</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">첫 생성까지 걸린 시간 (중앙값)</p>
              <p className="text-2xl font-black text-white">{formatMinutes(data.coreMetrics.medianTimeToFirstGenMinutes)}</p>
              <p className="text-[10px] text-slate-600 font-bold mt-1">가입 완료 → 첫 생성 성공 기준</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">재사용률</p>
              <p className="text-2xl font-black text-white">{data.coreMetrics.reuseRate !== null ? `${data.coreMetrics.reuseRate}%` : '—'}</p>
              <p className="text-[10px] text-slate-600 font-bold mt-1">생성 1회 이상 경험 {data.coreMetrics.reuseSampleSize}명 중 재생성 비율</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">무료 체험 → 유료 전환율</p>
              <p className="text-2xl font-black text-white">{data.coreMetrics.paidConversionRate !== null ? `${data.coreMetrics.paidConversionRate}%` : '—'}</p>
              <p className="text-[10px] text-slate-600 font-bold mt-1">생성 1회 이상 경험 {data.coreMetrics.paidConversionSampleSize}명 중 실제 충전 비율</p>
            </div>
          </div>

          {/* 퍼널 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white">🔻 가입 → 생성 완료 퍼널 <span className="text-slate-500 font-bold">(가입 후 {data.cohortDays}일 이내 기준)</span></h3>
            <div className="space-y-3">
              {data.funnel.map((f, i) => (
                <div key={f.step} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 text-xs font-black text-slate-400">{STEP_LABELS[f.step] ?? f.step}</div>
                  <div className="flex-1 bg-slate-800 rounded-lg h-8 relative overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-lg transition-all"
                      style={{ width: `${Math.max(4, (f.users / maxUsers) * 100)}%` }} />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-black text-white">{f.users.toLocaleString()}명</span>
                  </div>
                  <div className="w-16 shrink-0 text-right text-xs font-black">
                    {i === 0 ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span className={f.conversionFromPrev !== null && f.conversionFromPrev < 50 ? 'text-red-400' : 'text-emerald-400'}>
                        {f.conversionFromPrev !== null ? `${f.conversionFromPrev}%` : '—'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 font-bold">
              * 가입 기록(signup_completed)이 있는 사용자 {data.cohortSize}명 중, 각 단계를 가입 후 {data.cohortDays}일 이내에 도달한 고유 사용자 수 ·
              전환율은 바로 이전 단계 대비 비율
              {data.generationFailedUsers > 0 && <> · 생성 실패를 겪은 사용자 {data.generationFailedUsers}명</>}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 온보딩 선택 분포 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-black text-white">🪧 선택 화면에서 고른 기능</h3>
              {totalChoices === 0 ? (
                <p className="text-xs text-slate-500 font-bold">아직 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(data.onboardingChoices).sort((a, b) => b[1] - a[1]).map(([choice, count]) => {
                    const pct = Math.round((count / totalChoices) * 100);
                    return (
                      <div key={choice} className="flex items-center gap-3">
                        <div className="w-32 shrink-0 text-xs font-black text-slate-400">{CHOICE_LABELS[choice] ?? choice}</div>
                        <div className="flex-1 bg-slate-800 rounded-lg h-6 relative overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-lg" style={{ width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <div className="w-16 shrink-0 text-right text-xs font-black text-white">{count}명 ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI 도구별 점유율 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-black text-white">📊 AI 도구별 방문 점유율</h3>
              {totalPageViews === 0 ? (
                <p className="text-xs text-slate-500 font-bold">아직 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(data.pageViewCounts).sort((a, b) => b[1] - a[1]).map(([page, count]) => {
                    const pct = Math.round((count / totalPageViews) * 100);
                    return (
                      <div key={page} className="flex items-center gap-3">
                        <div className="w-32 shrink-0 text-xs font-black text-slate-400">{PAGE_LABELS[page] ?? page}</div>
                        <div className="flex-1 bg-slate-800 rounded-lg h-6 relative overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-lg" style={{ width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <div className="w-16 shrink-0 text-right text-xs font-black text-white">{count}회 ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-600 font-bold">* 총 {data.totalEvents.toLocaleString()}개 이벤트 집계 (최근 90일 로그 기준)</p>
        </>
      )}
    </div>
  );
}
