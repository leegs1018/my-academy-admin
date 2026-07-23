'use client';

import { useState, useEffect } from 'react';

interface Notice {
  id: number;
  title: string;
  content: string;
  is_important: boolean;
  created_at: string;
}

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notices')
      .then(r => r.json())
      .then(d => { setNotices(d.notices || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📢</div>
          <p className="text-gray-400 font-bold">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-2xl font-black text-gray-900">공지사항</h1>
        <p className="text-gray-400 font-bold mt-1 text-sm">관리팀에서 전달하는 공지사항입니다.</p>
      </div>

      {notices.length === 0 ? (
        <div className="text-center py-24 text-gray-300 font-bold">등록된 공지사항이 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {notices.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-2xl border-2 p-6 transition-all ${
                n.is_important
                  ? 'border-amber-400 shadow-md shadow-amber-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {n.is_important && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-300 rounded-full text-[11px] font-black">
                      ⚠ 중요 공지
                    </span>
                  )}
                  <h3 className="text-base font-black text-gray-900">{n.title}</h3>
                </div>
                <span className="text-xs font-bold text-gray-300 flex-shrink-0 mt-0.5">
                  {new Date(n.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
