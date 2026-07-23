import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase-admin';

export const metadata: Metadata = {
  title: '공지사항 | CON EDU',
  description: 'CON EDU 공지사항',
};

interface Notice {
  id: number;
  title: string;
  content: string;
  is_important: boolean;
  created_at: string;
}

async function getNotices(): Promise<Notice[]> {
  const db = createAdminClient();
  const { data } = await db
    .from('system_notices')
    .select('id, title, content, is_important, created_at')
    .order('is_important', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []) as Notice[];
}

export default async function NoticesPage() {
  const notices = await getNotices();

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* GNB */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center rotate-3 shadow-lg shadow-slate-200">
            <span className="text-yellow-400 font-black text-xl italic">C</span>
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-2xl font-black tracking-tighter text-slate-900">
              CON <span className="text-yellow-500">EDU</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em]">AI QUESTION GENERATOR</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/notices" className="px-5 py-2.5 text-sm font-bold text-slate-900 border-b-2 border-slate-900">
            공지사항
          </Link>
          <Link href="/pricing" className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            가격 안내
          </Link>
          <Link href="/register" className="px-5 py-2.5 text-sm font-bold border-2 border-slate-900 text-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all">
            솔루션 가입하기
          </Link>
          <Link href="/login" className="px-5 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all">
            로그인
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-16">
        <div className="mb-12">
          <p className="text-yellow-600 font-black text-xs uppercase tracking-widest mb-3">Announcements</p>
          <h1 className="text-4xl font-black text-slate-900">공지사항</h1>
          <p className="text-slate-400 font-medium mt-3">CON EDU 운영팀에서 전달하는 공지사항입니다.</p>
        </div>

        {notices.length === 0 ? (
          <div className="text-center py-24 text-slate-300 font-bold">등록된 공지사항이 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {notices.map(n => (
              <div
                key={n.id}
                className={`rounded-2xl border-2 p-7 ${
                  n.is_important
                    ? 'border-amber-300 bg-amber-50 shadow-sm shadow-amber-100'
                    : 'border-slate-100 bg-white hover:border-slate-200 transition-colors'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.is_important && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-300 rounded-full text-[11px] font-black">
                        ⚠ 중요 공지
                      </span>
                    )}
                    <h2 className="text-lg font-black text-slate-900">{n.title}</h2>
                  </div>
                  <span className="text-xs font-bold text-slate-300 flex-shrink-0 mt-1">
                    {new Date(n.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">{n.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">
            ← 메인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
