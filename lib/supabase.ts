// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Edge 등 strict 브라우저에서 sessionStorage 접근이 차단될 수 있어
// 안전하게 읽기/쓰기를 시도하는 커스텀 storage 어댑터를 사용합니다.
const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: safeStorage },
});