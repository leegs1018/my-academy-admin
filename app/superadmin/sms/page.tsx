'use client';

import { useState, useEffect } from 'react';

const SMS_LIMIT = 80;

interface Academy {
  user_id: string;
  academy_name: string;
  mobile: string;
  academy_phone: string;
  email: string;
}

interface SmsLog {
  id: number;
  message: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  created_at: string;
  recipients: any[];
}

export default function SuperAdminSmsPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'logs'>('send');
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/superadmin/academies').then(r => r.json()),
      fetch('/api/superadmin/sms/logs').then(r => r.json()),
    ]).then(([aData, lData]) => {
      setAcademies(aData.academies || []);
      setLogs(lData.logs || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const validRecipients = academies.filter(a =>
    selectedIds.has(a.user_id) && (a.mobile || a.academy_phone)
  );

  const allSelected = academies.length > 0 && academies.every(a => selectedIds.has(a.user_id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(academies.map(a => a.user_id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleSend = async () => {
    if (!message.trim() || validRecipients.length === 0) return;
    setIsSending(true);
    setShowConfirm(false);

    const recipients = validRecipients.map(a => ({
      academy_id: a.user_id,
      name: a.academy_name || a.email,
      phone: a.mobile || a.academy_phone,
    }));

    try {
      const res = await fetch('/api/superadmin/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, recipients }),
      });
      const result = await res.json();
      alert(`발송 완료 — 성공 ${result.success}건 / 실패 ${result.fail}건`);
      setMessage('');
      setSelectedIds(new Set());
      // 이력 새로고침
      const lData = await fetch('/api/superadmin/sms/logs').then(r => r.json());
      setLogs(lData.logs || []);
      setActiveTab('logs');
    } catch {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const messageType = message.length <= SMS_LIMIT ? 'SMS' : 'LMS';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center"><div className="text-4xl mb-4 animate-pulse">📱</div>
          <p className="text-slate-400 font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">📱 SMS 발송</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">등록된 학원 원장님들에게 SMS를 발송합니다</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-slate-800">
        <button onClick={() => setActiveTab('send')} className={`px-5 py-3 font-black text-sm rounded-t-xl transition-all ${activeTab === 'send' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          ✉️ 문자 발송
        </button>
        <button onClick={() => setActiveTab('logs')} className={`px-5 py-3 font-black text-sm rounded-t-xl transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          📋 발송 이력 <span className="ml-1 text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{logs.length}</span>
        </button>
      </div>

      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 수신자 선택 */}
          <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">수신자 선택</h2>
                <p className="text-xs text-slate-500 mt-0.5">총 {academies.length}개 학원 · 선택 {selectedIds.size}개</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-indigo-500" />
                <span className="text-xs font-black text-slate-400">전체선택</span>
              </label>
            </div>
            <div className="overflow-y-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4 text-left text-xs font-black text-slate-500">학원명</th>
                    <th className="py-3 px-4 text-left text-xs font-black text-slate-500">연락처</th>
                    <th className="py-3 px-4 text-left text-xs font-black text-slate-500 hidden sm:table-cell">이메일</th>
                  </tr>
                </thead>
                <tbody>
                  {academies.map(a => {
                    const phone = a.mobile || a.academy_phone;
                    const isSelected = selectedIds.has(a.user_id);
                    return (
                      <tr key={a.user_id} onClick={() => toggleOne(a.user_id)} className={`border-t border-slate-800 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-900/30' : 'hover:bg-slate-800/30'}`}>
                        <td className="py-3 px-4">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleOne(a.user_id)} onClick={e => e.stopPropagation()} className="w-4 h-4 accent-indigo-500" />
                        </td>
                        <td className="py-3 px-4 font-black text-white">{a.academy_name || '(미설정)'}</td>
                        <td className="py-3 px-4 text-xs font-bold text-slate-400">
                          {phone ? phone : <span className="text-red-400">번호 없음</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 hidden sm:table-cell">{a.email}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 메시지 작성 */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-white">메시지 내용</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${messageType === 'SMS' ? 'bg-green-900/50 text-green-400' : 'bg-orange-900/50 text-orange-400'}`}>{messageType}</span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="발송할 메시지를 입력하세요..."
                rows={8}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-sm font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
              />
              <div className="flex justify-between mt-2">
                <p className="text-[10px] text-slate-600">{messageType === 'SMS' ? '80자 이하: SMS' : '80자 초과: LMS'}</p>
                <span className={`text-xs font-black ${message.length > SMS_LIMIT ? 'text-orange-400' : 'text-slate-500'}`}>{message.length}자</span>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold">선택된 학원</span>
                  <span className="font-black text-white">{selectedIds.size}개</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold">발송 가능 (번호 있음)</span>
                  <span className="font-black text-indigo-400">{validRecipients.length}개</span>
                </div>
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={validRecipients.length === 0 || !message.trim() || isSending}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black text-base rounded-xl transition-all active:scale-95"
              >
                {isSending ? '발송 중...' : `📤 ${validRecipients.length}개 학원에 발송하기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-black text-white">발송 이력</h2>
          </div>
          {logs.length === 0 ? (
            <div className="py-16 text-center text-slate-600 font-bold">발송 이력이 없습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-black text-slate-500">발송일시</th>
                  <th className="py-3 px-4 text-left text-xs font-black text-slate-500">내용 미리보기</th>
                  <th className="py-3 px-4 text-center text-xs font-black text-slate-500">수신자</th>
                  <th className="py-3 px-4 text-center text-xs font-black text-slate-500">성공</th>
                  <th className="py-3 px-4 text-center text-xs font-black text-slate-500">실패</th>
                  <th className="py-3 px-4 text-center text-xs font-black text-slate-500">상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const d = new Date(log.created_at);
                  const ds = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  return (
                    <tr key={log.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-xs font-bold text-slate-400 whitespace-nowrap">{ds}</td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="text-sm text-white font-bold truncate block">{log.message}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-white">{log.total_count}</td>
                      <td className="py-3 px-4 text-center font-black text-emerald-400">{log.success_count}</td>
                      <td className="py-3 px-4 text-center font-black text-red-400">{log.fail_count || 0}</td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => setSelectedLog(log)} className="px-3 py-1.5 text-xs font-black text-indigo-400 bg-indigo-900/30 hover:bg-indigo-900/50 rounded-xl transition-all">상세</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 발송 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-700">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-black text-white">발송 확인</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-800 rounded-2xl p-4">
                <p className="text-xs font-black text-slate-500 mb-2">메시지 내용</p>
                <p className="text-sm text-white font-bold whitespace-pre-wrap">{message}</p>
              </div>
              <p className="text-sm text-slate-400 font-bold">수신자 <span className="text-white font-black">{validRecipients.length}개</span> 학원에 발송합니다.</p>
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 font-black text-slate-400 border-2 border-slate-700 rounded-xl">취소</button>
              <button onClick={handleSend} className="flex-[2] py-3 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all">📤 발송하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-700">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-white">발송 상세</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-800 rounded-2xl p-4">
                <p className="text-xs font-black text-slate-500 mb-1">메시지</p>
                <p className="text-sm text-white font-bold whitespace-pre-wrap">{selectedLog.message}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-800 rounded-xl p-3"><p className="text-2xl font-black text-white">{selectedLog.total_count}</p><p className="text-xs text-slate-500 font-bold mt-1">전체</p></div>
                <div className="bg-emerald-900/30 rounded-xl p-3"><p className="text-2xl font-black text-emerald-400">{selectedLog.success_count}</p><p className="text-xs text-emerald-600 font-bold mt-1">성공</p></div>
                <div className="bg-red-900/30 rounded-xl p-3"><p className="text-2xl font-black text-red-400">{selectedLog.fail_count || 0}</p><p className="text-xs text-red-600 font-bold mt-1">실패</p></div>
              </div>
              <div className="space-y-1.5">
                {(selectedLog.recipients || []).map((r: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-xl ${r.status === 'success' ? 'bg-emerald-900/20' : 'bg-red-900/20'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${r.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                      <span className="text-sm font-black text-white">{r.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-bold">{r.phone}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
