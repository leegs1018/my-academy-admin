'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function NoticePage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', is_important: false });

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = async () => {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('is_important', { ascending: false }) // 중요 공지 우선
      .order('created_at', { ascending: false });
    if (data) setNotices(data);
  };

  const handleSave = async () => {
    if (!newNotice.title || !newNotice.content) return alert('제목과 내용을 입력해주세요.');
    const { error } = await supabase.from('notices').insert([newNotice]);
    if (!error) {
      alert('공지사항이 등록되었습니다!');
      setIsWriteModalOpen(false);
      setNewNotice({ title: '', content: '', is_important: false });
      fetchNotices();
    }
  };

  const deleteNotice = async (id: number) => {
    if (!confirm('공지사항을 삭제하시겠습니까?')) return;
    await supabase.from('notices').delete().eq('id', id);
    fetchNotices();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center border-b-4 border-yellow-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-yellow-600">📢 학원 공지사항</h1>
          <p className="text-gray-400 font-bold mt-1">학생과 학부모님께 전달할 소식을 관리하세요.</p>
        </div>
        <button 
          onClick={() => setIsWriteModalOpen(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95"
        >
          새 공지 쓰기 ✏️
        </button>
      </div>

      {/* 공지 목록 */}
      <div className="space-y-4">
        {notices.length > 0 ? notices.map((n) => (
          <div key={n.id} className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all ${n.is_important ? 'border-yellow-400' : 'border-gray-50 hover:border-yellow-100'}`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {n.is_important && <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase">중요 공지</span>}
                <h3 className="text-xl font-black text-gray-800">{n.title}</h3>
              </div>
              <div className="flex gap-3 text-xs font-bold text-gray-300">
                <span>{new Date(n.created_at).toLocaleDateString()}</span>
                <button onClick={() => deleteNotice(n.id)} className="hover:text-red-500">삭제</button>
              </div>
            </div>
            <p className="text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">{n.content}</p>
          </div>
        )) : (
          <div className="text-center py-20 text-gray-300 font-bold italic">등록된 공지사항이 없습니다.</div>
        )}
      </div>

      {/* --- 글쓰기 모달 --- */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-yellow-500 text-white font-black flex justify-between">
              <h2 className="text-xl">새로운 공지 작성</h2>
              <button onClick={() => setIsWriteModalOpen(false)}>✕</button>
            </div>
            <div className="p-8 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" id="important" className="w-5 h-5 accent-yellow-500"
                  checked={newNotice.is_important} 
                  onChange={e => setNewNotice({...newNotice, is_important: e.target.checked})}
                />
                <label htmlFor="important" className="font-black text-yellow-600 cursor-pointer">이 게시글을 중요 공지로 설정</label>
              </div>
              <input 
                className="w-full border-2 p-4 rounded-2xl font-bold focus:border-yellow-500 outline-none" 
                placeholder="공지 제목을 입력하세요"
                value={newNotice.title}
                onChange={e => setNewNotice({...newNotice, title: e.target.value})}
              />
              <textarea 
                rows={8}
                className="w-full border-2 p-4 rounded-2xl font-medium focus:border-yellow-500 outline-none resize-none" 
                placeholder="공지 내용을 상세히 입력하세요..."
                value={newNotice.content}
                onChange={e => setNewNotice({...newNotice, content: e.target.value})}
              />
            </div>
            <div className="p-6 bg-gray-50 flex gap-4 font-black">
              <button onClick={() => setIsWriteModalOpen(false)} className="flex-1 py-4 text-gray-400 hover:bg-gray-200 rounded-2xl">취소</button>
              <button onClick={handleSave} className="flex-[2] py-4 bg-yellow-500 text-white rounded-2xl shadow-xl hover:bg-yellow-600 transition-all">공지사항 등록하기 ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}