'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

// SMS: 한글 기준 80자 이하, 초과 시 LMS
const SMS_LIMIT = 80;

function getMessageType(text: string) {
  return text.length <= SMS_LIMIT ? 'SMS' : 'LMS';
}

export default function SMSPage() {
  const [userId, setUserId] = useState('');

  // 학생 데이터
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterSchoolLevel, setFilterSchoolLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 수신자 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recipientType, setRecipientType] = useState<'student' | 'parent'>('parent');

  // 메시지 작성
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // 발송 처리
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sendResult, setSendResult] = useState<{ total: number; success: number; fail: number } | null>(null);
  const [showResultToast, setShowResultToast] = useState(false);

  // 탭
  const [activeTab, setActiveTab] = useState<'send' | 'logs'>('send');

  // 발송 이력
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // ── 초기 데이터 로드 ────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const uid = session.user.id;
      setUserId(uid);

      const [studentsRes, templatesRes, logsRes] = await Promise.all([
        supabase.from('students').select('*').eq('academy_id', uid).order('name', { ascending: true }),
        supabase.from('sms_templates').select('*').eq('academy_id', uid).order('created_at', { ascending: false }),
        supabase.from('sms_logs').select('*').eq('academy_id', uid).order('created_at', { ascending: false }),
      ]);

      setStudents(studentsRes.data || []);
      setTemplates(templatesRes.data || []);
      setLogs(logsRes.data || []);
      setLoading(false);
    };
    init();
  }, []);

  // ── 필터된 학생 목록 ────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.includes(searchTerm) ||
        (s.student_phone && s.student_phone.includes(searchTerm)) ||
        (s.parent_phone && s.parent_phone.includes(searchTerm));
      const matchClass = filterClass === '' || s.class_name === filterClass;
      const matchSchool = filterSchool === '' || s.school_name === filterSchool;
      const matchLevel = filterSchoolLevel === '' || s.school_level === filterSchoolLevel;
      const matchStatus = filterStatus === '' || s.status === filterStatus;
      return matchSearch && matchClass && matchSchool && matchLevel && matchStatus;
    });
  }, [students, searchTerm, filterClass, filterSchool, filterSchoolLevel, filterStatus]);

  // ── 중복 제거된 필터 옵션 ────────────────────────
  const classList = useMemo(() => [...new Set(students.map(s => s.class_name).filter(Boolean))].sort(), [students]);
  const schoolList = useMemo(() => [...new Set(students.map(s => s.school_name).filter(Boolean))].sort(), [students]);
  const schoolLevelList = useMemo(() => [...new Set(students.map(s => s.school_level).filter(Boolean))], [students]);

  // ── 선택 핸들러 ─────────────────────────────────
  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filteredStudents.forEach(s => next.delete(s.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredStudents.forEach(s => next.add(s.id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ── 선택된 학생 + 번호 계산 ──────────────────────
  const selectedStudents = students.filter(s => selectedIds.has(s.id));
  const validRecipients = selectedStudents.filter(s =>
    recipientType === 'student' ? !!s.student_phone : !!s.parent_phone
  );
  const noPhoneStudents = selectedStudents.filter(s =>
    recipientType === 'student' ? !s.student_phone : !s.parent_phone
  );

  // ── 필터 초기화 ─────────────────────────────────
  const resetFilters = () => {
    setSearchTerm('');
    setFilterClass('');
    setFilterSchool('');
    setFilterSchoolLevel('');
    setFilterStatus('');
  };

  // ── 템플릿 선택 ─────────────────────────────────
  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) setMessage(tpl.content);
  };

  // ── 템플릿 저장 ─────────────────────────────────
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !message.trim()) return;
    const { data, error } = await supabase.from('sms_templates').insert([{
      academy_id: userId,
      title: newTemplateName.trim(),
      content: message,
    }]).select().single();
    if (!error && data) {
      setTemplates(prev => [data, ...prev]);
      setNewTemplateName('');
      setShowSaveTemplate(false);
    }
  };

  // ── 템플릿 삭제 ─────────────────────────────────
  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (!confirm('선택한 템플릿을 삭제할까요?')) return;
    await supabase.from('sms_templates').delete().eq('id', selectedTemplateId);
    setTemplates(prev => prev.filter(t => t.id !== selectedTemplateId));
    setSelectedTemplateId('');
  };

  // ── 발송 실행 ────────────────────────────────────
  const handleSend = async () => {
    if (validRecipients.length === 0 || !message.trim()) return;
    setIsSending(true);
    setShowConfirmModal(false);

    const recipients = validRecipients.map(s => ({
      student_id: s.id,
      name: s.name,
      phone: (recipientType === 'student' ? s.student_phone : s.parent_phone) as string,
    }));

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, recipients }),
      });
      const result = await res.json();

      // 발송 이력 저장
      const { data: logData } = await supabase.from('sms_logs').insert([{
        academy_id: userId,
        message,
        recipient_type: recipientType,
        recipients: result.results,
        total_count: result.total,
        success_count: result.success,
        fail_count: result.fail,
      }]).select().single();

      if (logData) setLogs(prev => [logData, ...prev]);

      setSendResult(result);
      setShowResultToast(true);
      setTimeout(() => setShowResultToast(false), 4000);
      setSelectedIds(new Set());
      setMessage('');
    } catch {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const messageType = getMessageType(message);
  const charCount = message.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📱</div>
          <p className="text-gray-500 font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-800">📱 단체 문자 발송</h1>
        <p className="text-sm text-gray-400 mt-1 font-bold">수강생 또는 학부모에게 문자 메시지를 발송합니다</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-100">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-6 py-3 font-black text-base rounded-t-xl transition-all ${activeTab === 'send' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
        >
          ✉️ 문자 발송
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-3 font-black text-base rounded-t-xl transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
        >
          📋 발송 이력 <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{logs.length}</span>
        </button>
      </div>

      {/* ─── 발송 탭 ─── */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* 좌측: 수신자 선택 (3/5) */}
          <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-700">수신자 선택</h2>
              <p className="text-xs text-gray-400 mt-0.5">총 {students.length}명 · 필터 결과 {filteredStudents.length}명 · 선택됨 {selectedIds.size}명</p>
            </div>

            {/* 필터 영역 */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="이름 / 연락처 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-indigo-400 focus:outline-none"
                />
                <button
                  onClick={resetFilters}
                  className="px-3 py-2 text-xs font-black text-gray-400 hover:text-indigo-600 border-2 border-gray-200 hover:border-indigo-300 rounded-xl transition-all"
                >
                  초기화
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-2 py-2 text-xs font-bold focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">전체 상태</option>
                  <option value="재원">재원</option>
                  <option value="휴원">휴원</option>
                  <option value="퇴원">퇴원</option>
                </select>
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-2 py-2 text-xs font-bold focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">전체 클래스</option>
                  {classList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filterSchoolLevel}
                  onChange={e => { setFilterSchoolLevel(e.target.value); }}
                  className="border-2 border-gray-200 rounded-xl px-2 py-2 text-xs font-bold focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">전체 학교급</option>
                  {schoolLevelList.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                  value={filterSchool}
                  onChange={e => setFilterSchool(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-2 py-2 text-xs font-bold focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">전체 학교</option>
                  {schoolList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* 전체선택 */}
            <div className="px-6 py-3 flex items-center gap-3 border-b border-gray-100 bg-white">
              <input
                type="checkbox"
                id="select-all"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-indigo-600 cursor-pointer"
              />
              <label htmlFor="select-all" className="text-sm font-black text-gray-600 cursor-pointer select-none">
                {allFilteredSelected ? '전체 해제' : '전체 선택'} (필터 결과 {filteredStudents.length}명)
              </label>
            </div>

            {/* 학생 목록 */}
            <div className="overflow-y-auto max-h-[420px]">
              {filteredStudents.length === 0 ? (
                <div className="py-16 text-center text-gray-400 font-bold">
                  <p className="text-3xl mb-2">🔍</p>
                  <p>검색 결과가 없습니다</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 py-3 px-3"></th>
                      <th className="py-3 px-2 text-left text-xs font-black text-gray-400">이름</th>
                      <th className="py-3 px-2 text-left text-xs font-black text-gray-400 hidden sm:table-cell">학교</th>
                      <th className="py-3 px-2 text-left text-xs font-black text-gray-400">클래스</th>
                      <th className="py-3 px-2 text-left text-xs font-black text-gray-400">
                        {recipientType === 'student' ? '학생번호' : '보호자번호'}
                      </th>
                      <th className="py-3 px-2 text-left text-xs font-black text-gray-400 hidden sm:table-cell">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => {
                      const phone = recipientType === 'student' ? s.student_phone : s.parent_phone;
                      const isSelected = selectedIds.has(s.id);
                      const hasPhone = !!phone;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => toggleSelect(s.id)}
                          className={`border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(s.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 accent-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-black text-gray-800">{s.name}</span>
                          </td>
                          <td className="py-3 px-2 hidden sm:table-cell">
                            <span className="text-gray-500 text-xs">{s.school_name || '-'}</span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs text-indigo-600 font-bold">{s.class_name || '-'}</span>
                          </td>
                          <td className="py-3 px-2">
                            {hasPhone ? (
                              <span className="text-xs text-gray-600 font-bold">{phone}</span>
                            ) : (
                              <span className="text-xs text-red-400 font-bold">번호 없음</span>
                            )}
                          </td>
                          <td className="py-3 px-2 hidden sm:table-cell">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              s.status === '재원' ? 'bg-green-100 text-green-600' :
                              s.status === '휴원' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>{s.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 우측: 메시지 작성 (2/5) */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* 수신번호 선택 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">수신 번호 유형</h3>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all ${recipientType === 'parent' ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    value="parent"
                    checked={recipientType === 'parent'}
                    onChange={() => setRecipientType('parent')}
                    className="accent-indigo-600"
                  />
                  <div>
                    <p className="text-xs font-black text-gray-700">보호자 번호</p>
                    <p className="text-[10px] text-gray-400">학부모에게 발송</p>
                  </div>
                </label>
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all ${recipientType === 'student' ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    value="student"
                    checked={recipientType === 'student'}
                    onChange={() => setRecipientType('student')}
                    className="accent-indigo-600"
                  />
                  <div>
                    <p className="text-xs font-black text-gray-700">학생 번호</p>
                    <p className="text-[10px] text-gray-400">학생에게 직접 발송</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 문자 템플릿 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">문자 템플릿</h3>
              <div className="flex gap-2 mb-2">
                <select
                  value={selectedTemplateId}
                  onChange={e => handleTemplateSelect(e.target.value)}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">템플릿 선택...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                {selectedTemplateId && (
                  <button
                    onClick={handleDeleteTemplate}
                    className="px-3 py-2 text-xs font-black text-red-400 hover:text-red-600 border-2 border-red-100 hover:border-red-300 rounded-xl transition-all"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 템플릿 저장 */}
              {!showSaveTemplate ? (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="w-full py-2 text-xs font-black text-indigo-400 hover:text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl transition-all"
                >
                  + 현재 내용을 템플릿으로 저장
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="템플릿 이름 입력..."
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                    className="flex-1 border-2 border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTemplate}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => { setShowSaveTemplate(false); setNewTemplateName(''); }}
                    className="px-3 py-2 text-xs font-black text-gray-400 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            {/* 메시지 작성 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-gray-600">메시지 내용</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${messageType === 'SMS' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                  {messageType}
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="발송할 메시지를 입력하세요..."
                rows={7}
                className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm font-bold focus:border-indigo-400 focus:outline-none resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-gray-400">
                  {messageType === 'SMS' ? '80자 이하: SMS 요금 적용' : '80자 초과: LMS 요금 적용'}
                </p>
                <span className={`text-xs font-black ${charCount > SMS_LIMIT ? 'text-orange-500' : 'text-gray-400'}`}>
                  {charCount}자
                </span>
              </div>
            </div>

            {/* 발송 요약 + 버튼 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">선택된 수신자</span>
                  <span className="font-black text-gray-800">{selectedIds.size}명</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">발송 가능 (번호 있음)</span>
                  <span className="font-black text-indigo-600">{validRecipients.length}명</span>
                </div>
                {noPhoneStudents.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400 font-bold">번호 없음 (제외)</span>
                    <span className="font-black text-red-400">{noPhoneStudents.length}명</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={validRecipients.length === 0 || !message.trim() || isSending}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-base rounded-2xl transition-all active:scale-95 disabled:cursor-not-allowed"
              >
                {isSending ? '발송 중...' : `📤 ${validRecipients.length}명에게 발송하기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 발송 이력 탭 ─── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-black text-gray-700">발송 이력</h2>
          </div>
          {logs.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-400 font-bold">발송 이력이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-black text-gray-400">발송일시</th>
                    <th className="py-3 px-4 text-left text-xs font-black text-gray-400">내용 미리보기</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">수신 유형</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">수신자</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">성공</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">실패</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const date = new Date(log.created_at);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    return (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-gray-500 whitespace-nowrap">{dateStr}</td>
                        <td className="py-3 px-4 max-w-[200px]">
                          <span className="text-sm text-gray-700 font-bold truncate block">{log.message}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${log.recipient_type === 'parent' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {log.recipient_type === 'parent' ? '보호자' : '학생'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-gray-600">{log.total_count}</td>
                        <td className="py-3 px-4 text-center font-black text-green-500">{log.success_count}</td>
                        <td className="py-3 px-4 text-center font-black text-red-400">{log.fail_count || 0}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-3 py-1.5 text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                          >
                            상세
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── 발송 확인 모달 ─── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800">발송 확인</h3>
              <p className="text-sm text-gray-400 mt-1">아래 내용을 확인 후 발송해주세요</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* 메시지 미리보기 */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-black text-gray-400 mb-2">메시지 내용</p>
                <p className="text-sm text-gray-700 font-bold whitespace-pre-wrap">{message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${messageType === 'SMS' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{messageType}</span>
                  <span className="text-xs text-gray-400 font-bold">{charCount}자</span>
                </div>
              </div>

              {/* 수신자 요약 */}
              <div>
                <p className="text-xs font-black text-gray-400 mb-2">수신자 ({validRecipients.length}명 · {recipientType === 'parent' ? '보호자' : '학생'} 번호)</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {validRecipients.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 px-3 bg-indigo-50 rounded-xl">
                      <span className="text-sm font-black text-gray-700">{s.name}</span>
                      <span className="text-xs text-gray-500 font-bold">
                        {recipientType === 'student' ? s.student_phone : s.parent_phone}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 번호 없는 학생 경고 */}
              {noPhoneStudents.length > 0 && (
                <div className="bg-red-50 rounded-2xl p-4">
                  <p className="text-xs font-black text-red-500 mb-1">⚠️ 번호 없음 → 발송 제외 ({noPhoneStudents.length}명)</p>
                  <p className="text-xs text-red-400">{noPhoneStudents.map(s => s.name).join(', ')}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 font-black text-gray-500 border-2 border-gray-200 rounded-2xl hover:border-gray-300 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                className="flex-1 py-3 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all active:scale-95"
              >
                📤 발송하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 발송 이력 상세 모달 ─── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800">발송 상세</h3>
                <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(selectedLog.created_at).toLocaleString('ko-KR')}</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-black text-gray-400 mb-1">메시지 내용</p>
                <p className="text-sm text-gray-700 font-bold whitespace-pre-wrap">{selectedLog.message}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-2xl font-black text-gray-700">{selectedLog.total_count}</p>
                  <p className="text-xs text-gray-400 font-bold mt-1">전체</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-3">
                  <p className="text-2xl font-black text-green-500">{selectedLog.success_count}</p>
                  <p className="text-xs text-green-400 font-bold mt-1">성공</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-3">
                  <p className="text-2xl font-black text-red-400">{selectedLog.fail_count || 0}</p>
                  <p className="text-xs text-red-400 font-bold mt-1">실패</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 mb-2">수신자 상세</p>
                <div className="space-y-1.5">
                  {(selectedLog.recipients || []).map((r: any, i: number) => (
                    <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-xl ${r.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                        <span className="text-sm font-black text-gray-700">{r.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 font-bold">{r.phone}</span>
                        {r.error && <p className="text-[10px] text-red-400 font-bold">{r.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 발송 결과 토스트 ─── */}
      {showResultToast && sendResult && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce-once">
          <span className="text-2xl">📤</span>
          <div>
            <p className="font-black">발송 완료</p>
            <p className="text-sm text-gray-300">
              성공 <span className="text-green-400 font-black">{sendResult.success}건</span>
              {sendResult.fail > 0 && <> · 실패 <span className="text-red-400 font-black">{sendResult.fail}건</span></>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
