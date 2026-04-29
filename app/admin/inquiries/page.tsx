'use client';

import { useState, useEffect } from 'react';

interface Inquiry {
  id: number;
  title: string;
  content: string;
  answer: string | null;
  status: 'pending' | 'answered';
  created_at: string;
  answered_at: string | null;
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const fetchInquiries = () => {
    fetch('/api/admin/inquiries')
      .then(r => r.json())
      .then(d => { setInquiries(d.inquiries || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchInquiries(); }, []);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return alert('제목과 내용을 입력해주세요.');
    setSaving(true);
    const res = await fetch('/api/admin/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      setForm({ title: '', content: '' });
      fetchInquiries();
    } else {
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center"><div className="text-4xl mb-4 animate-pulse">💬</div>
          <p className="text-gray-400 font-bold">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center border-b-4 border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800">💬 문의하기</h1>
          <p className="text-gray-400 font-bold mt-1">관리자에게 문의사항을 남겨주세요.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gray-900 hover:bg-gray-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95"
        >
          문의 작성 ✏️
        </button>
      </div>

      <div className="space-y-3">
        {inquiries.length === 0 ? (
          <div className="text-center py-20 text-gray-300 font-bold italic">등록된 문의사항이 없습니다.</div>
        ) : (
          inquiries.map(i => (
            <div
              key={i.id}
              onClick={() => setSelectedInquiry(i)}
              className="bg-white p-5 rounded-2xl shadow-sm border-2 border-gray-50 hover:border-gray-200 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${i.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    {i.status === 'pending' ? '답변 대기' : '답변 완료'}
                  </span>
                  <h3 className="text-base font-black text-gray-800">{i.title}</h3>
                </div>
                <span className="text-xs font-bold text-gray-300">{new Date(i.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-500 font-medium truncate">{i.content}</p>
              {i.status === 'answered' && (
                <p className="text-xs text-indigo-500 font-bold mt-2">답변이 등록되었습니다. 클릭하여 확인하세요.</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* 문의 작성 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-gray-900 text-white font-black flex justify-between items-center">
              <h2 className="text-lg">문의 작성</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="p-8 space-y-4">
              <input
                className="w-full border-2 p-4 rounded-2xl font-bold focus:border-gray-900 outline-none"
                placeholder="문의 제목을 입력하세요"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                rows={6}
                className="w-full border-2 p-4 rounded-2xl font-medium focus:border-gray-900 outline-none resize-none"
                placeholder="문의 내용을 자세히 입력하세요..."
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="p-6 bg-gray-50 flex gap-4 font-black">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 text-gray-400 hover:bg-gray-200 rounded-2xl">취소</button>
              <button onClick={handleSubmit} disabled={saving} className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl shadow-xl hover:bg-gray-700 transition-all disabled:opacity-50">
                {saving ? '등록 중...' : '문의 등록하기 ✅'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 문의 상세 모달 */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-6 bg-gray-900 text-white font-black flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg">{selectedInquiry.title}</h2>
              <button onClick={() => setSelectedInquiry(null)}>✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-black text-gray-400 mb-2">문의 내용</p>
                <p className="text-sm text-gray-700 font-medium whitespace-pre-wrap leading-relaxed">{selectedInquiry.content}</p>
                <p className="text-xs text-gray-300 font-bold mt-3">{new Date(selectedInquiry.created_at).toLocaleString('ko-KR')}</p>
              </div>

              {selectedInquiry.status === 'answered' && selectedInquiry.answer ? (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4">
                  <p className="text-xs font-black text-indigo-600 mb-2">✅ 관리자 답변</p>
                  <p className="text-sm text-indigo-900 font-medium whitespace-pre-wrap leading-relaxed">{selectedInquiry.answer}</p>
                  {selectedInquiry.answered_at && (
                    <p className="text-xs text-indigo-300 font-bold mt-3">{new Date(selectedInquiry.answered_at).toLocaleString('ko-KR')}</p>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-4 text-center">
                  <p className="text-sm font-black text-orange-500">답변 대기 중입니다.</p>
                  <p className="text-xs text-orange-300 font-bold mt-1">관리자가 확인 후 답변을 등록합니다.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setSelectedInquiry(null)} className="w-full py-3 font-black text-gray-500 border-2 border-gray-200 rounded-2xl hover:border-gray-300 transition-all">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
