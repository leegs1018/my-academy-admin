'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function NoticePage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('system_notices')
        .select('*')
        .order('is_important', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) setNotices(data);
      setLoading(false);
    };
    fetch();
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
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      <div className="border-b-4 border-indigo-100 pb-6">
        <h1 className="text-3xl font-black text-indigo-600">📢 공지사항</h1>
        <p className="text-gray-400 font-bold mt-1">관리자로부터 전달되는 공지사항을 확인하세요.</p>
      </div>

      <div className="space-y-4">
        {notices.length > 0 ? notices.map((n) => (
          <div key={n.id} className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all ${n.is_important ? 'border-indigo-400' : 'border-gray-50 hover:border-indigo-100'}`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {n.is_important && (
                  <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase">중요 공지</span>
                )}
                <h3 className="text-xl font-black text-gray-800">{n.title}</h3>
              </div>
              <span className="text-xs font-bold text-gray-300">{new Date(n.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">{n.content}</p>
          </div>
        )) : (
          <div className="text-center py-20 text-gray-300 font-bold italic">등록된 공지사항이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
