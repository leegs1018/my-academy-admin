'use client';

import { useState, useEffect } from 'react';

interface SystemNotice {
  id: number;
  title: string;
  content: string;
  is_important: boolean;
  created_at: string;
}

export default function SystemNoticesPage() {
  const [notices, setNotices] = useState<SystemNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', is_important: false });
  const [saving, setSaving] = useState(false);

  const fetchNotices = () => {
    fetch('/api/superadmin/notices')
      .then(r => r.json())
      .then(d => { setNotices(d.notices || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchNotices(); }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return alert('제목과 내용을 입력하세요.');
    setSaving(true);
    const res = await fetch('/api/superadmin/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      setForm({ title: '', content: '', is_important: false });
      fetchNotices();
    } else {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 공지사항을 삭제할까요?')) return;
    const res = await fetch(`/api/superadmin/notices/${id}`, { method: 'DELETE' });
    if (res.ok) setNotices(prev => prev.filter(n => n.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📢</div>
          <p className="text-slate-400 font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">📢 공지사항 관리</h1>
          <p className="text-sm text-slate-500 mt-1 font-bold">모든 학원 원장님에게 표시되는 시스템 공지</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all active:scale-95"
        >
          + 새 공지 등록
        </button>
      </div>

      <div className="space-y-3">
        {notices.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 py-20 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-slate-600 font-bold">등록된 시스템 공지가 없습니다</p>
          </div>
        ) : (
          notices.map(n => (
            <div key={n.id} className={`bg-slate-900 rounded-2xl border-2 p-5 transition-all ${n.is_important ? 'border-indigo-500' : 'border-slate-800'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {n.is_important && (
                      <span className="px-2 py-0.5 bg-indigo-600/20 text-indigo-400 rounded-lg text-[10px] font-black">중요</span>
                    )}
                    <h3 className="text-base font-black text-white">{n.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 font-medium whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <p className="text-xs text-slate-600 font-bold mt-3">{new Date(n.created_at).toLocaleString('ko-KR')}</p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-black text-red-500 hover:bg-red-900/30 rounded-xl transition-all"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-700">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-white">시스템 공지 등록</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_important}
                  onChange={e => setForm({ ...form, is_important: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className="text-sm font-black text-indigo-400">중요 공지로 설정</span>
              </label>
              <input
                type="text"
                placeholder="공지 제목"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                rows={6}
                placeholder="공지 내용..."
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 font-black text-slate-400 border-2 border-slate-700 rounded-xl hover:border-slate-600 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] py-3 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? '저장 중...' : '공지 등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
