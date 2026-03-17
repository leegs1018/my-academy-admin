// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'; // 💡 ssr 패키지 사용 권장

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 이 객체 딱 하나만 애플리케이션 전체에서 공유합니다.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);