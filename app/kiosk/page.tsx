'use client';

import { useState, useEffect, useCallback } from 'react';

type Step = 'academy-code' | 'phone-input' | 'student-select' | 'action' | 'success' | 'error';

interface StudentInfo {
  id: string;
  name: string;
  class_name: string;
  today_status: '없음' | '등원' | '하원';
  last_action_at: string | null;
}

const COOKIE_ACADEMY_ID = 'kiosk_academy_id';
const COOKIE_ACADEMY_NAME = 'kiosk_academy_name';
const IDLE_TIMEOUT_MS = 30_000; // 30초 무조작 시 리셋

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

// 숫자 키패드 컴포넌트
function Keypad({ onPress, onDelete, disabled }: { onPress: (n: string) => void; onDelete: () => void; disabled?: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {keys.map((k, i) =>
        k === '' ? (
          <div key={i} />
        ) : k === '←' ? (
          <button
            key={i}
            onClick={onDelete}
            disabled={disabled}
            className="h-16 bg-slate-200 rounded-2xl text-2xl font-bold text-slate-600 active:bg-slate-300 transition-colors disabled:opacity-40"
          >
            ←
          </button>
        ) : (
          <button
            key={i}
            onClick={() => onPress(k)}
            disabled={disabled}
            className="h-16 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-800 active:bg-indigo-50 active:border-indigo-300 transition-colors disabled:opacity-40 shadow-sm"
          >
            {k}
          </button>
        )
      )}
    </div>
  );
}

// 숫자 입력 표시 컴포넌트
function CodeDisplay({ value, length, label }: { value: string; length: number; label: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-widest">{label}</p>
      <div className="flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={`w-12 h-14 flex items-center justify-center rounded-xl text-2xl font-black border-2 transition-all ${
              value[i]
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-slate-50 border-slate-200 text-transparent'
            }`}
          >
            {value[i] ? '●' : '○'}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KioskPage() {
  const [step, setStep] = useState<Step>('academy-code');
  const [academyId, setAcademyId] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [idleTimer, setIdleTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // 쿠키에서 학원 정보 로드
  useEffect(() => {
    const savedId = getCookie(COOKIE_ACADEMY_ID);
    const savedName = getCookie(COOKIE_ACADEMY_NAME);
    if (savedId && savedName) {
      setAcademyId(savedId);
      setAcademyName(savedName);
      setStep('phone-input');
    }
  }, []);

  // 무조작 타이머 리셋
  const resetIdleTimer = useCallback(() => {
    if (idleTimer) clearTimeout(idleTimer);
    const timer = setTimeout(() => {
      if (step !== 'academy-code') {
        setStep('phone-input');
        setPhoneInput('');
        setStudents([]);
        setSelectedStudent(null);
        setErrorMsg('');
      }
    }, IDLE_TIMEOUT_MS);
    setIdleTimer(timer);
  }, [idleTimer, step]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimer) clearTimeout(idleTimer); };
  }, [step, codeInput, phoneInput]);

  // 성공 후 카운트다운
  useEffect(() => {
    if (step === 'success') {
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setStep('phone-input');
            setPhoneInput('');
            setStudents([]);
            setSelectedStudent(null);
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  // 학원 코드 검증
  const handleVerifyAcademy = async (code: string) => {
    if (code.length !== 6) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/kiosk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_code: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '코드 확인에 실패했습니다.');
        setCodeInput('');
      } else {
        setCookie(COOKIE_ACADEMY_ID, data.academy_id);
        setCookie(COOKIE_ACADEMY_NAME, data.academy_name);
        setAcademyId(data.academy_id);
        setAcademyName(data.academy_name);
        setCodeInput('');
        setStep('phone-input');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 학생 조회
  const handleLookupStudent = async (phone: string) => {
    if (phone.length !== 4) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/kiosk/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academy_id: academyId, phone_last4: phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '학생 조회에 실패했습니다.');
        setPhoneInput('');
      } else {
        const studentList: StudentInfo[] = data.students;
        if (studentList.length === 1) {
          setSelectedStudent(studentList[0]);
          setStep('action');
        } else {
          setStudents(studentList);
          setStep('student-select');
        }
        setPhoneInput('');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 출결 처리
  const handleAttend = async (action: '등원' | '하원') => {
    if (!selectedStudent) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/kiosk/attend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academy_id: academyId,
          student_id: selectedStudent.id,
          action,
          academy_name: academyName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '처리 중 오류가 발생했습니다.');
      } else {
        setSelectedStudent((prev) => prev ? { ...prev, today_status: action } : prev);
        setStep('success');
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeKeyPress = (n: string) => {
    if (codeInput.length < 6) {
      const next = codeInput + n;
      setCodeInput(next);
      setErrorMsg('');
      if (next.length === 6) handleVerifyAcademy(next);
    }
  };

  const handlePhoneKeyPress = (n: string) => {
    if (phoneInput.length < 4) {
      const next = phoneInput + n;
      setPhoneInput(next);
      setErrorMsg('');
      if (next.length === 4) handleLookupStudent(next);
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex flex-col items-center justify-center p-6 select-none">
      {/* 헤더 */}
      <div className="text-center mb-8">
        {academyName ? (
          <h1 className="text-3xl font-black text-indigo-600">{academyName}</h1>
        ) : (
          <h1 className="text-3xl font-black text-slate-700">클래스허브 출결</h1>
        )}
        <p className="text-slate-400 font-bold mt-1">{dateStr}</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 p-8 border border-slate-100">

        {/* STEP 1: 학원 코드 입력 */}
        {step === 'academy-code' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🏫</div>
              <h2 className="text-xl font-black text-slate-800">학원 코드 입력</h2>
              <p className="text-sm text-slate-400 mt-1">발급받은 학원 6자리 코드를 입력하세요</p>
            </div>
            <CodeDisplay value={codeInput} length={6} label="학원 코드" />
            {errorMsg && <p className="text-center text-red-500 text-sm font-bold mb-4">{errorMsg}</p>}
            <Keypad
              onPress={handleCodeKeyPress}
              onDelete={() => { setCodeInput((p) => p.slice(0, -1)); setErrorMsg(''); }}
              disabled={loading}
            />
          </div>
        )}

        {/* STEP 2: 핸드폰 뒷자리 입력 */}
        {step === 'phone-input' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📱</div>
              <h2 className="text-xl font-black text-slate-800">학생 인증</h2>
              <p className="text-sm text-slate-400 mt-1">핸드폰 번호 뒷 4자리를 입력하세요</p>
            </div>
            <CodeDisplay value={phoneInput} length={4} label="핸드폰 뒷 4자리" />
            {errorMsg && <p className="text-center text-red-500 text-sm font-bold mb-4">{errorMsg}</p>}
            <Keypad
              onPress={handlePhoneKeyPress}
              onDelete={() => { setPhoneInput((p) => p.slice(0, -1)); setErrorMsg(''); }}
              disabled={loading}
            />
            {loading && <p className="text-center text-indigo-400 text-sm font-bold mt-4">조회 중...</p>}
            <button
              onClick={() => { document.cookie = `${COOKIE_ACADEMY_ID}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; document.cookie = `${COOKIE_ACADEMY_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; setAcademyId(''); setAcademyName(''); setStep('academy-code'); }}
              className="mt-6 w-full text-xs text-slate-300 hover:text-slate-500 transition-colors"
            >
              학원 코드 재입력
            </button>
          </div>
        )}

        {/* STEP 2-1: 학생 선택 (중복 뒷자리) */}
        {step === 'student-select' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">👥</div>
              <h2 className="text-xl font-black text-slate-800">학생 선택</h2>
              <p className="text-sm text-slate-400 mt-1">해당하는 학생을 선택하세요</p>
            </div>
            <div className="space-y-3">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => { setSelectedStudent(student); setStep('action'); }}
                  className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition-all active:scale-95"
                >
                  <p className="font-black text-slate-800 text-lg">{student.name}</p>
                  <p className="text-sm text-slate-400 font-medium">{student.class_name}</p>
                  {student.today_status !== '없음' && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${student.today_status === '등원' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                      오늘 {student.today_status} 완료
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setStep('phone-input'); setStudents([]); }}
              className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600 font-bold transition-colors"
            >
              ← 다시 입력
            </button>
          </div>
        )}

        {/* STEP 3: 등원/하원 선택 */}
        {step === 'action' && selectedStudent && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">👋</div>
              <h2 className="text-2xl font-black text-slate-800">{selectedStudent.name}</h2>
              <p className="text-sm text-slate-400 font-medium mt-1">{selectedStudent.class_name}</p>
              {selectedStudent.today_status !== '없음' && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full mt-2 inline-block ${selectedStudent.today_status === '등원' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                  오늘 {selectedStudent.today_status} 완료
                </span>
              )}
            </div>

            {errorMsg && <p className="text-center text-red-500 text-sm font-bold mb-4 bg-red-50 p-3 rounded-xl">{errorMsg}</p>}

            {selectedStudent.today_status === '하원' ? (
              <div className="text-center py-4">
                <p className="text-slate-500 font-bold">오늘 하원이 완료되었습니다.</p>
                <p className="text-slate-400 text-sm mt-1">내일 또 와요!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => handleAttend('등원')}
                  disabled={loading || selectedStudent.today_status === '등원'}
                  className={`w-full py-5 rounded-2xl text-xl font-black transition-all active:scale-95 ${
                    selectedStudent.today_status === '없음'
                      ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-200'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {selectedStudent.today_status === '등원' ? '✅ 등원 완료' : '🏫 등원'}
                </button>
                <button
                  onClick={() => handleAttend('하원')}
                  disabled={loading || selectedStudent.today_status === '없음'}
                  className={`w-full py-5 rounded-2xl text-xl font-black transition-all active:scale-95 ${
                    selectedStudent.today_status === '등원'
                      ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  🏠 하원
                </button>
              </div>
            )}

            {loading && <p className="text-center text-indigo-400 text-sm font-bold mt-4">처리 중...</p>}

            <button
              onClick={() => { setStep('phone-input'); setSelectedStudent(null); setErrorMsg(''); }}
              className="mt-6 w-full text-sm text-slate-400 hover:text-slate-600 font-bold transition-colors"
            >
              ← 다시 입력
            </button>
          </div>
        )}

        {/* STEP 4: 성공 */}
        {step === 'success' && selectedStudent && (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
              ✅
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">{selectedStudent.name}</h2>
            <p className="text-lg font-bold text-green-600 mb-2">
              {selectedStudent.today_status} 처리 완료
            </p>
            <p className="text-sm text-slate-400 mb-2">학부모님께 알림이 발송되었습니다.</p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm">
                {countdown}
              </div>
              <span className="text-sm text-slate-400 font-medium">초 후 초기화됩니다</span>
            </div>
            <button
              onClick={() => { setStep('phone-input'); setPhoneInput(''); setStudents([]); setSelectedStudent(null); }}
              className="mt-4 w-full py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 transition-colors"
            >
              다음 학생
            </button>
          </div>
        )}
      </div>

      {/* 하단 안내 */}
      <p className="text-xs text-slate-300 font-medium mt-6">
        {step !== 'academy-code' && '30초 무조작 시 자동으로 초기화됩니다'}
      </p>
    </div>
  );
}
