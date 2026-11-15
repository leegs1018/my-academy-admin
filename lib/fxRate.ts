import { createAdminClient } from '@/lib/supabase-admin';

// KST 기준 오늘 날짜 (YYYY-MM-DD)
export function todayKst(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// 지정한 날짜의 USD/KRW 환율을 반환한다. DB 캐시를 먼저 확인하고,
// 없으면 외부 환율 API(frankfurter.app, 무료·인증 불필요)에서 가져와 캐시에 저장한다.
// 주말/공휴일 등 데이터가 없는 날짜는 frankfurter가 직전 영업일 환율을 돌려준다.
export async function getUsdKrwRate(dateStr: string): Promise<{ date: string; rate: number }> {
  const db = createAdminClient();

  const { data: cached } = await db
    .from('fx_rates')
    .select('rate_date, usd_krw')
    .eq('rate_date', dateStr)
    .maybeSingle();
  if (cached) return { date: cached.rate_date, rate: Number(cached.usd_krw) };

  const today = todayKst();
  const url = dateStr >= today
    ? 'https://api.frankfurter.app/latest?from=USD&to=KRW'
    : `https://api.frankfurter.app/${dateStr}?from=USD&to=KRW`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`환율 조회 실패 (${res.status})`);
  const json = await res.json() as { date: string; rates: { KRW: number } };
  const rate = json.rates.KRW;
  const actualDate = json.date; // 주말/공휴일이면 직전 영업일 날짜가 돌아온다

  // 요청한 날짜 키로 캐시해 다음에는 외부 호출 없이 바로 재사용한다
  // (actualDate가 다르더라도, 그 날짜의 "적용 환율"은 actualDate의 값이 맞다).
  await db.from('fx_rates').upsert({ rate_date: dateStr, usd_krw: rate }, { onConflict: 'rate_date' });
  if (actualDate !== dateStr) {
    await db.from('fx_rates').upsert({ rate_date: actualDate, usd_krw: rate }, { onConflict: 'rate_date' });
  }

  return { date: dateStr, rate };
}
