'use client';

import { supabase } from '@/lib/supabase';

// 가입→선택→AI 체험→생성 퍼널 통계용 이벤트 기록.
// 통계 실패가 실제 기능(문제 생성 등)을 막으면 안 되므로 항상 fire-and-forget,
// 실패는 조용히 무시한다.
export function trackEvent(eventName: string, metadata?: Record<string, unknown>): void {
  try {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      void fetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventName, metadata }),
      }).catch(() => {});
    }).catch(() => {});
  } catch { /* 통계 실패는 무시 */ }
}
