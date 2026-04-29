'use client';

import { useState, useEffect } from 'react';

interface Inquiry {
  id: number;
  academy_id: string;
  academy_name: string;
  email: string;
  title: string;
  content: string;
  answer: string | null;
  status: 'pending' | 'answered';
  created_at: string;
  answered_at: string | null;
}

export default function SuperAdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'answered'>('all');

  const fetchInquiries = () => {
    fetch('/api/superadmin/inquiries')
      .then(r => r.json())
      .then(d => { setInquiries(d.inquiries || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchInquiries(); }, []);

  const handleAnswer = async () => {
    if (!selectedInquiry || !answer.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/superadmin/inquiries/${selectedInquiry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    setSubmitting(false);
    if (res.ok) {
      setInquiries(prev => prev.map(i => i.id === selectedInquiry.id
        ? { ...i, answer, status: 'answered', answered_at: new Date().toISOString() }
        : i
      ));
      setSelectedInquiry(prev => prev ? { ...prev, answer, status: 'answered' } : null);
      setAnswer('');
    } else {
      alert('답변 저장에 실패했습니다.');
    }
  };

  const filtered = inquiries.filter(i => filterStatus === 'all' || i.status === filterStatus);
  const pendingCount = inquiries.filter(i => i.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center"><div className="text-4xl mb-4 animate-pulse">💬</div>
          <p className="text-slate-400 font-bold">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">💬 문의 관리</h1>
          <p className="text-sm text-slate-500 mt-1 font-bold">
            전체 {inquiries.length}건
            {pendingCount > 0 && <span className="ml-2 text-red-400">· 답변 대기 {pendingCount}건</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'answered'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {s === 'all' ? '전체' : s === 'pending' ? '답변 대기' : '답변 완료'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-600 font-bold">문의가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">날짜</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">학원명</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500 hidden md:table-cell">이메일</th>
                <th className="py-3 px-4 text-left text-xs font-black text-slate-500">제목</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">상태</th>
                <th className="py-3 px-4 text-center text-xs font-black text-slate-500">답변</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const d = new Date(i.created_at);
                const ds = `${d.getMonth()+1}/${d.getDate()}`;
                return (
                  <tr key={i.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">{ds}</td>
                    <td className="py-3 px-4 font-black text-white">{i.academy_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-400 hidden md:table-cell">{i.email}</td>
                    <td className="py-3 px-4 text-sm font-bold text-slate-300 max-w-[180px] truncate">{i.title}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${i.status === 'pending' ? 'bg-red-900/40 text-red-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                        {i.status === 'pending' ? '답변 대기' : '답변 완료'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => { setSelectedInquiry(i); setAnswer(i.answer || ''); }} className="px-3 py-1.5 text-xs font-black text-indigo-400 bg-indigo-900/30 hover:bg-indigo-900/50 rounded-xl transition-all">
                        {i.status === 'pending' ? '답변하기' : '보기'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 문의 상세 + 답변 모달 */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-700">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">{selectedInquiry.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedInquiry.academy_name} · {selectedInquiry.email} · {new Date(selectedInquiry.created_at).toLocaleString('ko-KR')}</p>
              </div>
              <button onClick={() => setSelectedInquiry(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* 문의 내용 */}
              <div className="bg-slate-800 rounded-2xl p-4">
                <p className="text-xs font-black text-slate-500 mb-2">문의 내용</p>
                <p className="text-sm text-white font-medium whitespace-pre-wrap leading-relaxed">{selectedInquiry.content}</p>
              </div>

              {/* 기존 답변 */}
              {selectedInquiry.status === 'answered' && selectedInquiry.answer && (
                <div className="bg-indigo-900/20 border border-indigo-800 rounded-2xl p-4">
                  <p className="text-xs font-black text-indigo-400 mb-2">답변 완료</p>
                  <p className="text-sm text-white font-medium whitespace-pre-wrap leading-relaxed">{selectedInquiry.answer}</p>
                </div>
              )}

              {/* 답변 입력 */}
              {selectedInquiry.status === 'pending' && (
                <div>
                  <p className="text-xs font-black text-slate-500 mb-2">답변 작성</p>
                  <textarea
                    rows={5}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="답변 내용을 입력하세요..."
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {selectedInquiry.status === 'pending' && (
              <div className="p-6 border-t border-slate-800 flex gap-3">
                <button onClick={() => setSelectedInquiry(null)} className="flex-1 py-3 font-black text-slate-400 border-2 border-slate-700 rounded-xl">닫기</button>
                <button onClick={handleAnswer} disabled={submitting || !answer.trim()} className="flex-[2] py-3 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50">
                  {submitting ? '저장 중...' : '✅ 답변 등록'}
                </button>
              </div>
            )}
            {selectedInquiry.status === 'answered' && (
              <div className="p-6 border-t border-slate-800">
                <button onClick={() => setSelectedInquiry(null)} className="w-full py-3 font-black text-slate-400 border-2 border-slate-700 rounded-xl">닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
