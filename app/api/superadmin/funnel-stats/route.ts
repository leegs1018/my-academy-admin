import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

// 가입 → 선택 화면 → AI 체험 → 생성 완료까지의 핵심 단계.
// generation_failed는 별도 집계(이탈이 아니라 "시도했지만 실패"라서 순서에 넣지 않음).
const FUNNEL_STEPS = [
  'signup_completed', 'onboarding_viewed', 'onboarding_selected',
  'ai_page_viewed', 'passage_entered', 'generation_clicked', 'generation_completed',
] as const;

// con_transactions에서 "실제 충전"과 구분해야 하는 무료 보너스 성격의 feature_key들.
const BONUS_FEATURE_KEYS = new Set(['signup_bonus', 'signup_bonus_referral', 'profile_completion_bonus', 'referral_reward']);

interface EventRow {
  user_id: string;
  event_name: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  // "가입 후 N일"이라는 동일한 관찰 기간을 모든 사용자에게 적용해야 전환율 비교가 의미 있다.
  const cohortDays = Math.min(30, Math.max(1, parseInt(searchParams.get('days') ?? '7') || 7));
  const cohortWindowMs = cohortDays * 86400000;

  const supabase = createAdminClient();
  // 코호트 분석은 사용자별 가입 시점부터 추적해야 하므로 넉넉하게 최근 90일치를 가져온다.
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('events_log')
    .select('user_id, event_name, metadata, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as EventRow[];

  // 사용자별 이벤트명 → 최초 발생 시각(ms)
  const firstSeenByUser = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    let userMap = firstSeenByUser.get(r.user_id);
    if (!userMap) { userMap = new Map(); firstSeenByUser.set(r.user_id, userMap); }
    if (!userMap.has(r.event_name)) userMap.set(r.event_name, t);
  }

  // signup_completed 기록이 있는 사용자만 "코호트" 대상으로 삼는다
  // (이 로그 도입 이전 가입자는 기준 시점(t0)이 없어 비교가 불가능하므로 제외).
  const now = Date.now();
  const cohorts = [...firstSeenByUser.entries()]
    .map(([userId, evts]) => ({ userId, t0: evts.get('signup_completed') }))
    .filter((c): c is { userId: string; t0: number } => c.t0 !== undefined)
    .map(c => ({ ...c, windowElapsed: now - c.t0 >= cohortWindowMs }));

  // 퍼널: "가입 후 cohortDays일 이내"에 각 단계에 도달한 사용자 수
  // (관찰 기간이 아직 다 지나지 않은 최근 가입자도 포함하므로, 뒷 단계일수록 다소 낮게 보일 수 있다)
  const funnelRaw = FUNNEL_STEPS.map(step => ({
    step,
    users: cohorts.filter(c => {
      const t = firstSeenByUser.get(c.userId)?.get(step);
      return t !== undefined && t - c.t0 <= cohortWindowMs;
    }).length,
  }));
  const funnel = funnelRaw.map((f, i) => ({
    ...f,
    conversionFromPrev: i === 0 || funnelRaw[i - 1].users === 0 ? null : Math.round((f.users / funnelRaw[i - 1].users) * 1000) / 10,
  }));

  const generationFailedUsers = cohorts.filter(c => {
    const t = firstSeenByUser.get(c.userId)?.get('generation_failed');
    return t !== undefined && t - c.t0 <= cohortWindowMs;
  }).length;

  // 온보딩 선택 분포 / AI 도구별 방문 점유율 — 코호트 제한 없이 전체 기간 기준
  const onboardingChoices: Record<string, number> = {};
  const pageViewCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.event_name === 'onboarding_selected') {
      const choice = typeof r.metadata?.choice === 'string' ? r.metadata.choice : 'unknown';
      onboardingChoices[choice] = (onboardingChoices[choice] ?? 0) + 1;
    }
    if (r.event_name === 'ai_page_viewed') {
      const page = typeof r.metadata?.page === 'string' ? r.metadata.page : 'unknown';
      pageViewCounts[page] = (pageViewCounts[page] ?? 0) + 1;
    }
  }

  // ── 핵심 지표 4가지 ──

  // 1) 가입 후 N일 내 첫 생성 완료율: 관찰 기간이 이미 다 지난 가입자만 분모로 삼아야
  //    (아직 N일이 안 지난 최근 가입자를 넣으면) 수치가 부당하게 낮게 나오는 걸 막는다.
  const eligibleCohorts = cohorts.filter(c => c.windowElapsed);
  const eligibleFirstGenUsers = eligibleCohorts.filter(c => {
    const t = firstSeenByUser.get(c.userId)?.get('generation_completed');
    return t !== undefined && t - c.t0 <= cohortWindowMs;
  });
  const firstGenerationRate = eligibleCohorts.length > 0
    ? Math.round((eligibleFirstGenUsers.length / eligibleCohorts.length) * 1000) / 10
    : null;

  // 2) 가입~첫 생성 완료까지 걸린 시간의 중앙값 (기간 제한 없이, 생성 이력이 있는 전체 코호트 대상)
  const timeToFirstGenMinutes: number[] = [];
  for (const c of cohorts) {
    const t = firstSeenByUser.get(c.userId)?.get('generation_completed');
    if (t !== undefined) timeToFirstGenMinutes.push((t - c.t0) / 60000);
  }
  timeToFirstGenMinutes.sort((a, b) => a - b);
  const medianTimeToFirstGenMinutes = timeToFirstGenMinutes.length > 0
    ? Math.round(timeToFirstGenMinutes[Math.floor(timeToFirstGenMinutes.length / 2)])
    : null;

  // 3) 재사용률: 첫 생성 완료 이후 다른 시점에 다시 생성을 완료한 사용자 비율
  const completedCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.event_name !== 'generation_completed') continue;
    completedCounts.set(r.user_id, (completedCounts.get(r.user_id) ?? 0) + 1);
  }
  const usersWithFirstGen = cohorts.filter(c => completedCounts.has(c.userId));
  const reusedUsers = usersWithFirstGen.filter(c => (completedCounts.get(c.userId) ?? 0) >= 2);
  const reuseRate = usersWithFirstGen.length > 0
    ? Math.round((reusedUsers.length / usersWithFirstGen.length) * 1000) / 10
    : null;

  // 4) 무료 체험 후 유료 전환율: 생성 완료 이력이 있는 사용자 중, 가입/추천 보너스가 아닌
  //    실제 충전(con_transactions type='charge', 보너스 feature_key 제외) 이력이 있는 비율
  let paidConversionRate: number | null = null;
  if (usersWithFirstGen.length > 0) {
    const userIds = usersWithFirstGen.map(c => c.userId);
    const { data: txRows } = await supabase
      .from('con_transactions')
      .select('academy_id, feature_key')
      .eq('type', 'charge')
      .in('academy_id', userIds);
    const paidUserIds = new Set(
      (txRows ?? [])
        .filter((t: { feature_key: string | null }) => !BONUS_FEATURE_KEYS.has(t.feature_key ?? ''))
        .map((t: { academy_id: string }) => t.academy_id)
    );
    paidConversionRate = Math.round((paidUserIds.size / usersWithFirstGen.length) * 1000) / 10;
  }

  return NextResponse.json({
    cohortDays,
    totalEvents: rows.length,
    cohortSize: cohorts.length,
    funnel,
    generationFailedUsers,
    onboardingChoices,
    pageViewCounts,
    coreMetrics: {
      eligibleCohortSize: eligibleCohorts.length,
      firstGenerationRate,
      medianTimeToFirstGenMinutes,
      reuseRate,
      reuseSampleSize: usersWithFirstGen.length,
      paidConversionRate,
      paidConversionSampleSize: usersWithFirstGen.length,
    },
  });
}
