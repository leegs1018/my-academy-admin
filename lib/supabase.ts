// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr';

// Edge 추적 방지(Strict) 등으로 sessionStorage가 차단된 환경을 위한 폴리필.
// Supabase Realtime 클라이언트가 내부적으로 sessionStorage를 직접 접근하기 때문에
// createBrowserClient 호출 이전에 메모리 기반 대체 구현을 주입합니다.
if (typeof window !== 'undefined') {
  try {
    window.sessionStorage.getItem('__probe__');
  } catch {
    const mem: Record<string, string> = {};
    const fallback: Storage = {
      getItem: (k) => mem[k] ?? null,
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
      clear: () => { Object.keys(mem).forEach(k => delete mem[k]); },
      get length() { return Object.keys(mem).length; },
      key: (i) => Object.keys(mem)[i] ?? null,
    };
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: fallback, configurable: true, writable: true,
      });
    } catch { /* 브라우저가 오버라이드 자체를 막는 경우 - 더 이상 할 수 없음 */ }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);