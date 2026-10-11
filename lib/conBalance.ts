// CON 차감/충전 직후 상단 헤더의 잔액 표시를 새로고침 없이 즉시 갱신하기 위한 이벤트.
// ClientLayout이 이 이벤트를 구독해 잔액만 가볍게 다시 조회한다.
export const CON_BALANCE_CHANGED_EVENT = 'con-balance-changed';

export function notifyConBalanceChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CON_BALANCE_CHANGED_EVENT));
}
