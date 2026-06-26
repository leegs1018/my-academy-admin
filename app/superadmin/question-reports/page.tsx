'use client';

import { useState, useEffect } from 'react';

interface QuestionReport {
  id: string;
  academy_id: string;
  user_email: string;
  academy_name: string;
  history_id: string;
  question_index: number;
  question_type: string;
  question_json: {
    type: string;
    question_text: string;
    modified_passage?: string;
    choices: { number: number; text: string }[];
    answer: number;
    explanation: string;
    _passageText?: string;
  };
  passage_text: string;
  con_amount: number;
  rating: 'good' | 'bad';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const TYPE_LABEL_MAP: Record<string, string> = {
  topic_title: '주제/제목',
  grammar: '어법',
  vocab_paraphrase: '어휘-낱말',
  vocab_blank: '어휘(a)(b)',
  fill_blank: '빈칸추론',
  summary: '요약문',
  flow: '흐름',
  phrase_meaning: '어구의미',
  sentence_order: '순서배열',
};

export default function QuestionReportsPage() {
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<QuestionReport | null>(null);

  const fetchReports = async (status: 'pending' | 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/question-reports?status=${status}`);
      const data = await res.json() as { reports?: QuestionReport[]; error?: string };
      setReports(data.reports ?? []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(statusFilter);
  }, [statusFilter]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(action === 'approve' ? 'CON을 환불하고 승인하시겠습니까?' : '이 신고를 거절하시겠습니까?')) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/superadmin/question-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json() as { success?: boolean; error?: string; new_balance?: number };
      if (!res.ok) { alert(`처리 실패: ${data.error}`); return; }
      if (action === 'approve' && data.new_balance !== undefined) {
        alert(`승인 완료! CON 환불됨. 현재 잔액: ${data.new_balance.toLocaleString()} CON`);
      }
      await fetchReports(statusFilter);
    } catch {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">🚨 문제 품질 신고 관리</h1>
          <p className="text-sm text-slate-400 mt-1">👎 신고된 문제를 검토하고 CON 환불 여부를 결정합니다.</p>
        </div>

        {/* 상태 필터 탭 */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'pending',  label: '⏳ 대기중' },
            { key: 'approved', label: '✅ 승인됨' },
            { key: 'rejected', label: '❌ 거절됨' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all
                ${statusFilter === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl p-16 text-center border border-slate-800">
            <p className="text-4xl mb-4">📭</p>
            <p className="font-black text-slate-400 text-lg">신고 내역이 없습니다</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {/* 헤더 */}
            <div className="grid grid-cols-[160px_140px_100px_1fr_90px_80px_140px] gap-3 px-5 py-3 bg-slate-800 text-xs font-black text-slate-400">
              <span>아이디</span>
              <span>학원명</span>
              <span>날짜</span>
              <span>문제 내용</span>
              <span>유형</span>
              <span className="text-center">CON</span>
              <span className="text-center">처리</span>
            </div>

            {/* 목록 */}
            {reports.map((report, i) => (
              <div
                key={report.id}
                className={`grid grid-cols-[160px_140px_100px_1fr_90px_80px_140px] gap-3 px-5 py-4 items-center border-b border-slate-800 last:border-0
                  ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}
              >
                {/* 아이디 */}
                <span className="text-xs font-bold text-slate-300 truncate" title={report.user_email}>
                  {report.user_email}
                </span>

                {/* 학원명 */}
                <span className="text-xs font-bold text-slate-300 truncate">
                  {report.academy_name || '-'}
                </span>

                {/* 날짜 */}
                <span className="text-xs font-bold text-slate-500">
                  {new Date(report.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                  <br />
                  {new Date(report.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>

                {/* 문제 내용 */}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-300 truncate">
                    {report.question_json?.question_text?.slice(0, 80) ?? '-'}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setDetailModal(report)}
                      className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 underline"
                    >
                      문제 보기
                    </button>
                    {(report.passage_text || report.question_json?._passageText) && (
                      <button
                        onClick={() => setDetailModal({ ...report, _showPassage: true } as QuestionReport)}
                        className="text-[10px] font-black text-slate-400 hover:text-slate-300 underline"
                      >
                        지문 보기
                      </button>
                    )}
                  </div>
                </div>

                {/* 유형 */}
                <span className="text-[10px] font-black px-2 py-1 rounded-full bg-slate-700 text-slate-300 text-center">
                  {TYPE_LABEL_MAP[report.question_type] ?? report.question_type}
                </span>

                {/* CON */}
                <span className="text-center text-sm font-black text-amber-400">
                  {report.con_amount}C
                </span>

                {/* 처리 */}
                <div className="flex gap-1.5 justify-center">
                  {report.status === 'pending' ? (
                    <>
                      <button
                        disabled={processingId === report.id}
                        onClick={() => handleAction(report.id, 'approve')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg disabled:opacity-50 transition-all"
                      >
                        {processingId === report.id ? '...' : '✅ 승인'}
                      </button>
                      <button
                        disabled={processingId === report.id}
                        onClick={() => handleAction(report.id, 'reject')}
                        className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-black rounded-lg disabled:opacity-50 transition-all"
                      >
                        {processingId === report.id ? '...' : '❌ 거절'}
                      </button>
                    </>
                  ) : (
                    <span className={`text-xs font-black px-3 py-1.5 rounded-lg
                      ${report.status === 'approved' ? 'bg-emerald-900 text-emerald-400' : 'bg-rose-900 text-rose-400'}`}>
                      {report.status === 'approved' ? '✅ 승인됨' : '❌ 거절됨'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setDetailModal(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white">
                {(detailModal as QuestionReport & { _showPassage?: boolean })._showPassage ? '📄 지문 내용' : '📝 문제 상세'}
              </h2>
              <button onClick={() => setDetailModal(null)} className="text-slate-400 hover:text-white text-xl font-black">✕</button>
            </div>

            {(detailModal as QuestionReport & { _showPassage?: boolean })._showPassage ? (
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {detailModal.passage_text || detailModal.question_json?._passageText || '-'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-black text-slate-500 mb-2">유형</p>
                  <span className="text-xs font-black px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                    {TYPE_LABEL_MAP[detailModal.question_type] ?? detailModal.question_type}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-500 mb-2">문제 지시문</p>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {detailModal.question_json?.question_text ?? '-'}
                    </p>
                  </div>
                </div>
                {detailModal.question_json?.modified_passage && (
                  <div>
                    <p className="text-xs font-black text-slate-500 mb-2">지문 (변형)</p>
                    <div className="bg-slate-800 rounded-xl p-4">
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {detailModal.question_json.modified_passage}
                      </p>
                    </div>
                  </div>
                )}
                {detailModal.question_json?.choices?.length > 0 && (
                  <div>
                    <p className="text-xs font-black text-slate-500 mb-2">선지</p>
                    <div className="space-y-2">
                      {detailModal.question_json.choices.map((c, ci) => (
                        <div key={ci} className={`flex gap-2 p-2.5 rounded-lg text-sm
                          ${ci + 1 === detailModal.question_json.answer ? 'bg-indigo-900/50 text-indigo-300 font-black' : 'bg-slate-800 text-slate-300'}`}>
                          <span className="font-black flex-shrink-0">{'①②③④⑤'[ci]}</span>
                          <span>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-black text-slate-500 mb-2">정답 / 해설</p>
                  <div className="bg-indigo-900/30 border border-indigo-700/40 rounded-xl p-4">
                    <p className="text-sm font-black text-indigo-300 mb-2">정답: {'①②③④⑤'[detailModal.question_json.answer - 1] ?? detailModal.question_json.answer}번</p>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{detailModal.question_json.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
