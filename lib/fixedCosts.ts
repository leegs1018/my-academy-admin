// 고정비(주/월 반복) 등록 1건을 특정 조회 기간 안에서 실제 발생일들로 펼쳐준다.
// 예: 매월 1일 반복, 시작일 2026-01-01, 조회기간 2026-01-01~2026-03-31
//     → ['2026-01-01', '2026-02-01', '2026-03-01']
export function materializeOccurrences(
  startDate: string,
  endDate: string | null,
  cycle: 'weekly' | 'monthly',
  rangeStart: string,
  rangeEnd: string
): string[] {
  const occurrences: string[] = [];
  const start = new Date(startDate + 'T00:00:00Z');
  const rStart = new Date(rangeStart + 'T00:00:00Z');
  const rEnd = new Date(rangeEnd + 'T00:00:00Z');
  const hardEnd = endDate ? new Date(endDate + 'T00:00:00Z') : null;
  if (hardEnd && hardEnd < start) return occurrences;

  if (cycle === 'weekly') {
    let cur = new Date(start);
    if (cur < rStart) {
      const diffDays = Math.floor((rStart.getTime() - cur.getTime()) / 86400000);
      const steps = Math.ceil(diffDays / 7);
      cur = new Date(cur.getTime() + steps * 7 * 86400000);
    }
    while (cur <= rEnd && (!hardEnd || cur <= hardEnd)) {
      if (cur >= rStart) occurrences.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur.getTime() + 7 * 86400000);
    }
    return occurrences;
  }

  // monthly: 시작일의 "일(day)"을 유지하되, 해당 월의 마지막 날을 넘지 않도록 보정한다.
  const startDay = start.getUTCDate();
  const makeDate = (y: number, m: number) => {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(startDay, lastDay)));
  };
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  let cur = makeDate(y, m);
  while (cur < rStart) {
    m += 1; if (m > 11) { m = 0; y += 1; }
    cur = makeDate(y, m);
  }
  while (cur <= rEnd && (!hardEnd || cur <= hardEnd)) {
    occurrences.push(cur.toISOString().slice(0, 10));
    m += 1; if (m > 11) { m = 0; y += 1; }
    cur = makeDate(y, m);
  }
  return occurrences;
}
