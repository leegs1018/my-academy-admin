'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const formatSendDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  const day = DAY_LABELS[d.getDay()];
  return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일(${day})`;
};

function getKoreanByteLength(str: string): number {
  let bytes = 0;
  for (const ch of str) bytes += ch.charCodeAt(0) > 127 ? 2 : 1;
  return bytes;
}

type ActiveTab = 'input' | 'send' | 'logs';

const DEFAULT_GRADE_HEADER = '[{학원}]\n{날짜} {이름} 성적 리포트';

interface GradeTemplate {
  id: string;
  title: string;
  header_template: string;
  created_at: string;
}

export default function GradeInputPage() {
  // ── 공통 ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('input');
  const [userId, setUserId] = useState('');
  const [academyName, setAcademyName] = useState('');

  // ── 탭1: 성적 입력 ────────────────────────────────
  const [classList, setClassList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [maxScore, setMaxScore] = useState(100);
  const [dynamicCategories, setDynamicCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [sessionDates, setSessionDates] = useState<{label: string, fullDate: string}[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ── 탭2: 성적 발송 ────────────────────────────────
  const [sendClassId, setSendClassId] = useState('');
  const [sendStudents, setSendStudents] = useState<any[]>([]);
  const [sendSelectedStudentIds, setSendSelectedStudentIds] = useState<Set<string>>(new Set());
  const [sendAvailableSessions, setSendAvailableSessions] = useState<string[]>([]);
  const [sendSelectedSession, setSendSelectedSession] = useState('');
  const [sendAvailableCategories, setSendAvailableCategories] = useState<{id: string, name: string}[]>([]);
  const [sendSelectedCategoryIds, setSendSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [sendGradeMap, setSendGradeMap] = useState<Record<string, number>>({});
  const [sendMaxScoreMap, setSendMaxScoreMap] = useState<Record<string, number>>({});
  const [sendShowMaxScore, setSendShowMaxScore] = useState(false);
  const [sendMessagePreviews, setSendMessagePreviews] = useState<any[]>([]);
  const [sendRecipientType, setSendRecipientType] = useState<'parent' | 'student' | 'both'>('parent');
  const [sendIsSending, setSendIsSending] = useState(false);
  const [sendShowConfirmModal, setSendShowConfirmModal] = useState(false);
  const [sendResult, setSendResult] = useState<{total: number; success: number; fail: number} | null>(null);
  const [sendShowResultToast, setSendShowResultToast] = useState(false);

  // ── 탭3: 발송 이력 ────────────────────────────────
  const [gradeLogs, setGradeLogs] = useState<any[]>([]);
  const [selectedGradeLog, setSelectedGradeLog] = useState<any>(null);
  const [selectedGradeRecipient, setSelectedGradeRecipient] = useState<any>(null);
  const [selectedGradeLogIds, setSelectedGradeLogIds] = useState<Set<string>>(new Set());
  const [isDeletingGradeLogs, setIsDeletingGradeLogs] = useState(false);

  // ── 성적 발송 템플릿 ──────────────────────────────
  const [gradeTemplates, setGradeTemplates] = useState<GradeTemplate[]>([]);
  const [selectedGradeTemplateId, setSelectedGradeTemplateId] = useState('');
  const [gradeHeaderTemplate, setGradeHeaderTemplate] = useState(DEFAULT_GRADE_HEADER);
  const [showSaveGradeTemplate, setShowSaveGradeTemplate] = useState(false);
  const [newGradeTemplateName, setNewGradeTemplateName] = useState('');

  // ── CON 단가 ──────────────────────────────────────
  const [smsPricePerUnit, setSmsPricePerUnit] = useState<number | null>(null);
  const [lmsPricePerUnit, setLmsPricePerUnit] = useState<number | null>(null);

  // ── 초기: userId + academyName + 로그 로드 ─────────
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const uid = session.user.id;
      setUserId(uid);

      const { data: cfg } = await supabase.from('academy_config').select('academy_name').eq('user_id', uid).single();
      if (cfg?.academy_name) setAcademyName(cfg.academy_name);

      const { data: logs } = await supabase.from('sms_logs').select('*').eq('academy_id', uid).order('created_at', { ascending: false });
      if (logs) setGradeLogs(logs);
    };
    getUser();
  }, []);

  // ── SMS/LMS 단가 로드 ─────────────────────────────
  useEffect(() => {
    fetch('/api/credits/pricing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list: { feature_key: string; cost_per_use: number }[] = data?.pricing ?? [];
        const sms = list.find(p => p.feature_key === 'sms');
        const lms = list.find(p => p.feature_key === 'lms');
        if (sms) setSmsPricePerUnit(sms.cost_per_use);
        if (lms) setLmsPricePerUnit(lms.cost_per_use);
      })
      .catch(() => {});
  }, []);

  // ── 탭1: 클래스 목록 로드 ─────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase.from('classes').select('*').eq('academy_id', userId).order('class_name')
      .then(({ data }) => { if (data) setClassList(data); });
    supabase.from('grade_message_templates').select('*').eq('academy_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setGradeTemplates(data); });
  }, [userId]);

  // ── 탭1: 클래스/월/과목 변경 시 데이터 로드 ───────
  useEffect(() => {
    if (!selectedClassId || classList.length === 0) {
      setStudents([]); setSessionDates([]); setSubjectDescription(''); return;
    }
    const currentClass = classList.find(c => c.id.toString() === selectedClassId);
    if (currentClass) {
      const cats = Array.isArray(currentClass.test_categories) ? currentClass.test_categories : [];
      setDynamicCategories(cats);
      if (selectedCategoryId) {
        const activeDays: number[] = [];
        if (currentClass.sun) activeDays.push(0);
        if (currentClass.mon) activeDays.push(1);
        if (currentClass.tue) activeDays.push(2);
        if (currentClass.wed) activeDays.push(3);
        if (currentClass.thu) activeDays.push(4);
        if (currentClass.fri) activeDays.push(5);
        if (currentClass.sat) activeDays.push(6);
        const currentCat = cats.find((c: any) => c.id === selectedCategoryId);
        fetchMaxScore(selectedCategoryId);
        fetchData(selectedClassId, selectedMonth, selectedCategoryId, currentCat?.name || '', activeDays);
        setSubjectDescription(currentCat?.description || '');
      }
    }
  }, [selectedClassId, selectedMonth, selectedCategoryId, classList]);

  // ── 탭2: sendClassId 변경 시 ──────────────────────
  useEffect(() => {
    if (!sendClassId || !userId || classList.length === 0) return;
    setSendSelectedSession('');
    setSendAvailableSessions([]);
    setSendAvailableCategories([]);
    setSendSelectedCategoryIds(new Set());
    setSendGradeMap({});
    setSendMessagePreviews([]);

    const currentClass = classList.find(c => c.id.toString() === sendClassId);
    if (!currentClass) return;

    supabase.from('students').select('id,name,student_phone,parent_phone,status')
      .eq('academy_id', userId).eq('class_name', currentClass.class_name).eq('status', '재원')
      .order('name').then(({ data }) => {
        if (data) {
          setSendStudents(data);
          setSendSelectedStudentIds(new Set(data.map((s: any) => s.id)));
        }
      });

    supabase.from('grades').select('test_date')
      .eq('class_id', parseInt(sendClassId)).eq('academy_id', userId)
      .order('test_date', { ascending: false }).then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: any) => r.test_date as string))];
          setSendAvailableSessions(unique);
          if (unique.length > 0) setSendSelectedSession(unique[0]);
        }
      });
  }, [sendClassId, userId, classList]);

  // ── 탭2: selectedSession 변경 or 발송 탭 전환 시 성적 새로고침 ──
  useEffect(() => {
    if (activeTab !== 'send' || !sendSelectedSession || !sendClassId || !userId) return;
    supabase.from('grades').select('student_id,category_id,score,max_score')
      .eq('class_id', parseInt(sendClassId)).eq('academy_id', userId).eq('test_date', sendSelectedSession)
      .then(({ data }) => {
        if (!data) return;
        const gradeMap: Record<string, number> = {};
        const maxScoreMap: Record<string, number> = {};
        data.forEach((g: any) => {
          gradeMap[`${String(g.student_id).trim()}__${String(g.category_id).trim()}`] = g.score;
          if (g.max_score != null) maxScoreMap[String(g.category_id).trim()] = g.max_score;
        });
        setSendGradeMap(gradeMap);
        setSendMaxScoreMap(maxScoreMap);

        // 클래스에 등록된 모든 과목을 표시 (해당 날짜에 성적이 없는 과목도 포함)
        const currentClass = classList.find(c => c.id.toString() === sendClassId);
        const classCats = Array.isArray(currentClass?.test_categories) ? currentClass.test_categories : [];
        setSendAvailableCategories(classCats);
        setSendSelectedCategoryIds(new Set(classCats.map((c: any) => String(c.id).trim())));
      });
  }, [sendSelectedSession, sendClassId, userId, classList, activeTab]);

  // ── 탭2: 메시지 미리보기 재생성 ───────────────────
  useEffect(() => {
    if (!sendSelectedSession || sendStudents.length === 0) {
      setSendMessagePreviews([]);
      return;
    }
    const dateLabel = formatSendDate(sendSelectedSession);
    const selectedCats = sendAvailableCategories.filter(c => sendSelectedCategoryIds.has(c.id));
    const previews = sendStudents
      .filter(s => sendSelectedStudentIds.has(s.id))
      .map(student => {
        const scoreEntries = selectedCats
          .map(cat => {
            const score = sendGradeMap[`${student.id}__${cat.id}`];
            const maxScore = sendMaxScoreMap[cat.id] ?? 100;
            return score !== undefined ? { name: cat.name, score, maxScore } : null;
          })
          .filter(Boolean) as { name: string; score: number; maxScore: number }[];
        if (scoreEntries.length === 0) {
          return { studentId: student.id, studentName: student.name, parentPhone: student.parent_phone || null, studentPhone: student.student_phone || null, message: null };
        }
        const header = gradeHeaderTemplate
          .replace('{학원}', academyName || '학원')
          .replace('{이름}', student.name)
          .replace('{날짜}', dateLabel);
        const scoreLines = scoreEntries.map((e, i) => {
          const scoreStr = sendShowMaxScore ? `${e.score}/${e.maxScore}점` : `${e.score}점`;
          return i === scoreEntries.length - 1 ? `${e.name}: ${scoreStr} 입니다.` : `${e.name}: ${scoreStr}`;
        }).join('\n');
        return {
          studentId: student.id,
          studentName: student.name,
          parentPhone: student.parent_phone || null,
          studentPhone: student.student_phone || null,
          message: `${header}\n\n${scoreLines}`,
        };
      });
    setSendMessagePreviews(previews);
  }, [sendSelectedStudentIds, sendSelectedCategoryIds, sendGradeMap, sendMaxScoreMap, sendShowMaxScore, sendSelectedSession, academyName, sendStudents, sendAvailableCategories, gradeHeaderTemplate]);

  // ── 탭1 함수들 ────────────────────────────────────
  const fetchMaxScore = async (catId: string) => {
    if (!catId) return;
    const cleanId = String(catId).replace(/['"]+/g, '').trim();
    try {
      const { data } = await supabase.from('grades').select('max_score').eq('category_id', cleanId)
        .order('test_date', { ascending: false }).limit(1);
      if (data && data.length > 0) setMaxScore(data[0].max_score);
      else setMaxScore(100);
    } catch (err) { console.error(err); }
  };

  const fetchData = async (classId: string, month: number, catId: string, catName: string, targetDays: number[]) => {
    setLoading(true);
    try {
      const year = 2026;
      const currentClassObj = classList.find(c => c.id.toString() === classId);
      const targetClassName = currentClassObj?.class_name || '';
      const lastDayOfMonth = new Date(year, month, 0).getDate();

      let actualSessions: {label: string, fullDate: string}[] = [];
      for (let d = 1; d <= lastDayOfMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        const fullDate = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (targetDays.includes(dateObj.getDay())) {
          actualSessions.push({ label: formatShortDate(fullDate), fullDate });
        }
      }
      actualSessions.sort((a, b) => a.fullDate.localeCompare(b.fullDate));

      const sessionLimit = (targetDays.length > 0 ? targetDays.length : 2) * 4;
      if (actualSessions.length > sessionLimit) {
        actualSessions = actualSessions.slice(0, sessionLimit);
      }

      const { data: studentData } = await supabase.from('students').select('*').eq('academy_id', userId).eq('class_name', targetClassName);
      const { data: allGradeData } = await supabase.from('grades').select('*').eq('academy_id', userId).eq('category_id', catId).eq('class_id', parseInt(classId));

      if (studentData) {
        const sortedStudents = [...studentData].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        const formatted = sortedStudents.map(student => {
          const scores = Array(actualSessions.length).fill('');
          actualSessions.forEach((session, i) => {
            const found = allGradeData?.find(g =>
              g.student_id === student.id && g.test_name.includes(`${month}월 ${i + 1}회차`)
            );
            if (found) {
              scores[i] = (found.score === 0 || found.score === null) ? '' : found.score.toString();
              if (found.test_date) {
                actualSessions[i].fullDate = found.test_date;
                actualSessions[i].label = formatShortDate(found.test_date);
              }
            }
          });
          return { ...student, scores };
        });
        setSessionDates(actualSessions);
        setStudents(formatted);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateSessionDate = (idx: number, newFullDate: string) => {
    const updatedSessions = [...sessionDates];
    updatedSessions[idx] = { label: formatShortDate(newFullDate), fullDate: newFullDate };
    updatedSessions.sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    setSessionDates(updatedSessions);
  };

  const handleScoreChange = (studentId: string, idx: number, value: string) => {
    if (value === '') {
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, scores: s.scores.map((v: any, i: number) => i === idx ? '' : v) } : s));
      return;
    }
    const num = Number(value);
    if (num < 0 || num > maxScore) return;
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, scores: s.scores.map((v: any, i: number) => i === idx ? value : v) } : s));
  };

  const handleSave = async () => {
    if (!selectedCategoryId) return alert('과목 선택 필수!');
    setLoading(true);
    const currentCat = dynamicCategories.find(c => c.id === selectedCategoryId);
    const catName = currentCat?.name || '과목';

    const newGrades: any[] = [];
    sessionDates.forEach((session, idx) => {
      const tName = `[${catName}] ${selectedMonth}월 ${idx + 1}회차`;
      students.forEach(student => {
        const score = student.scores[idx];
        newGrades.push({
          academy_id: userId,
          student_id: student.id,
          category_id: selectedCategoryId,
          class_id: parseInt(selectedClassId),
          test_name: tName,
          score: score === '' ? 0 : parseInt(score),
          test_date: session.fullDate,
          max_score: maxScore,
        });
      });
    });

    // 해당 월 날짜 범위 (과목명 변경과 무관하게 category_id + class_id + 날짜로 삭제)
    const year = 2026;
    const startDate = `${year}-${String(selectedMonth).padStart(2, '0')}-01`;
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const nextYear = selectedMonth === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    try {
      const studentIds = students.map(s => s.id);
      if (studentIds.length > 0) {
        const { error: delError } = await supabase
          .from('grades')
          .delete()
          .eq('academy_id', userId)
          .eq('category_id', selectedCategoryId)
          .eq('class_id', parseInt(selectedClassId))
          .in('student_id', studentIds)
          .gte('test_date', startDate)
          .lt('test_date', endDate);
        if (delError) throw delError;
      }
      if (newGrades.length > 0) {
        const { error: insError } = await supabase.from('grades').insert(newGrades);
        if (insError) throw insError;
      }
      alert('성적이 성공적으로 저장되었습니다! ✅');
      fetchMaxScore(selectedCategoryId);
    } catch (err) { console.error(err); alert('저장 중 오류 발생'); }
    finally { setLoading(false); }
  };

  // ── 성적 템플릿 핸들러 ────────────────────────────
  const handleGradeTemplateSelect = (id: string) => {
    setSelectedGradeTemplateId(id);
    const tpl = gradeTemplates.find(t => t.id === id);
    if (tpl) setGradeHeaderTemplate(tpl.header_template);
  };

  const handleSaveGradeTemplate = async () => {
    if (!newGradeTemplateName.trim()) return;
    const { data, error } = await supabase.from('grade_message_templates').insert([{
      academy_id: userId,
      title: newGradeTemplateName.trim(),
      header_template: gradeHeaderTemplate,
    }]).select().single();
    if (!error && data) {
      setGradeTemplates(prev => [data, ...prev]);
      setNewGradeTemplateName('');
      setShowSaveGradeTemplate(false);
    } else {
      alert(`저장 실패: ${error?.message || '오류'}\n\nSupabase에서 grade_message_templates 테이블을 먼저 생성해주세요.`);
    }
  };

  const handleDeleteGradeTemplate = async () => {
    if (!selectedGradeTemplateId) return;
    if (!confirm('선택한 템플릿을 삭제할까요?')) return;
    await supabase.from('grade_message_templates').delete().eq('id', selectedGradeTemplateId);
    setGradeTemplates(prev => prev.filter(t => t.id !== selectedGradeTemplateId));
    setSelectedGradeTemplateId('');
    setGradeHeaderTemplate(DEFAULT_GRADE_HEADER);
  };

  // ── 탭3: 발송 이력 핸들러 ────────────────────────
  const toggleSelectGradeLog = (id: string) => {
    setSelectedGradeLogIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };
  const allGradeLogsSelected = gradeLogs.length > 0 && gradeLogs.every(l => selectedGradeLogIds.has(l.id));
  const toggleSelectAllGradeLogs = () => {
    if (allGradeLogsSelected) setSelectedGradeLogIds(new Set());
    else setSelectedGradeLogIds(new Set(gradeLogs.map(l => l.id)));
  };
  const handleDeleteGradeLogs = async () => {
    const ids = [...selectedGradeLogIds];
    if (!confirm(`선택한 ${ids.length}건을 삭제할까요?`)) return;
    setIsDeletingGradeLogs(true);
    await supabase.from('sms_logs').delete().in('id', ids);
    setGradeLogs(prev => prev.filter(l => !selectedGradeLogIds.has(l.id)));
    setSelectedGradeLogIds(new Set());
    setIsDeletingGradeLogs(false);
  };
  const handleDeleteSingleGradeLog = async (id: string) => {
    if (!confirm('이 발송 이력을 삭제할까요?')) return;
    await supabase.from('sms_logs').delete().eq('id', id);
    setGradeLogs(prev => prev.filter(l => l.id !== id));
    setSelectedGradeLogIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  // ── 탭2 헬퍼 함수들 ───────────────────────────────
  const toggleSendStudent = (id: string) => {
    const next = new Set(sendSelectedStudentIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSendSelectedStudentIds(next);
  };

  const toggleAllSendStudents = () => {
    if (sendSelectedStudentIds.size === sendStudents.length) setSendSelectedStudentIds(new Set());
    else setSendSelectedStudentIds(new Set(sendStudents.map(s => s.id)));
  };

  const toggleSendCategory = (id: string) => {
    const next = new Set(sendSelectedCategoryIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSendSelectedCategoryIds(next);
  };

  const getPhoneForRecipient = (preview: any, type: 'parent' | 'student' | 'both') => {
    if (type === 'parent') return preview.parentPhone;
    if (type === 'student') return preview.studentPhone;
    return preview.parentPhone || preview.studentPhone;
  };

  const validSendPreviews = sendMessagePreviews.filter(p => p.message && getPhoneForRecipient(p, sendRecipientType));
  const noPhoneCount = sendMessagePreviews.filter(p => p.message && !getPhoneForRecipient(p, sendRecipientType)).length;

  // CON 계산: 각 메시지 발송 건수 × 단가 합산
  const sendConBreakdown = (() => {
    let smsCount = 0;
    let lmsCount = 0;
    for (const p of validSendPreviews) {
      const isLMS = p.message && getKoreanByteLength(p.message) > 90;
      let phones = 0;
      if ((sendRecipientType === 'parent' || sendRecipientType === 'both') && p.parentPhone) phones++;
      if ((sendRecipientType === 'student' || sendRecipientType === 'both') && p.studentPhone) phones++;
      if (isLMS) lmsCount += phones; else smsCount += phones;
    }
    const smsCon = smsPricePerUnit !== null ? smsCount * smsPricePerUnit : null;
    const lmsCon = lmsPricePerUnit !== null ? lmsCount * lmsPricePerUnit : null;
    const total = smsCon !== null && lmsCon !== null ? smsCon + lmsCon : null;
    return { smsCount, lmsCount, smsCon, lmsCon, total };
  })();

  const handleGradeSend = async () => {
    setSendIsSending(true);
    setSendShowConfirmModal(false);

    const allResults: any[] = [];
    let totalSuccess = 0;
    let totalFail = 0;

    for (const preview of sendMessagePreviews) {
      if (!preview.message) continue;

      const phonesToSend: string[] = [];
      if ((sendRecipientType === 'parent' || sendRecipientType === 'both') && preview.parentPhone) {
        phonesToSend.push(preview.parentPhone);
      }
      if ((sendRecipientType === 'student' || sendRecipientType === 'both') && preview.studentPhone) {
        phonesToSend.push(preview.studentPhone);
      }

      for (const phone of phonesToSend) {
        try {
          const res = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: preview.message,
              recipients: [{ student_id: preview.studentId, name: preview.studentName, phone }],
              academy_id: userId,
            }),
          });
          const result = await res.json();
          if (result.results) {
            allResults.push(...result.results.map((r: any) => ({
              ...r,
              message: preview.message,
            })));
          }
          totalSuccess += result.success || 0;
          totalFail += result.fail || 0;
        } catch {
          allResults.push({ student_id: preview.studentId, name: preview.studentName, phone, status: 'fail', error: '발송 오류', message: preview.message });
          totalFail++;
        }
      }
    }

    const representativeMessage = sendMessagePreviews.find(p => p.message)?.message || '';
    const { data: logData } = await supabase.from('sms_logs').insert([{
      academy_id: userId,
      message: representativeMessage,
      recipient_type: sendRecipientType,
      recipients: allResults,
      total_count: allResults.length,
      success_count: totalSuccess,
      fail_count: totalFail,
    }]).select().single();

    if (logData) setGradeLogs(prev => [logData, ...prev]);

    setSendResult({ total: allResults.length, success: totalSuccess, fail: totalFail });
    setSendShowResultToast(true);
    setTimeout(() => setSendShowResultToast(false), 4000);
    setSendIsSending(false);
  };

  // ── 렌더 ──────────────────────────────────────────
  return (
    <div className="max-w-[98%] mx-auto py-10 px-4 font-sans tracking-tight bg-slate-50 min-h-screen">

      {/* 페이지 제목 */}
      <div className="mb-2">
        <h1 className="text-2xl font-black text-indigo-900">성적 관리</h1>
        <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em]">Academic Records System</p>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-100">
        <button onClick={() => setActiveTab('input')}
          className={`px-6 py-3 font-black text-base rounded-t-xl transition-all ${activeTab === 'input' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
          📝 성적 입력 매니저
        </button>
        <button onClick={() => setActiveTab('send')}
          className={`px-6 py-3 font-black text-base rounded-t-xl transition-all ${activeTab === 'send' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
          📤 성적 발송
        </button>
        <button onClick={() => setActiveTab('logs')}
          className={`px-6 py-3 font-black text-base rounded-t-xl transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
          📋 발송 이력 <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{gradeLogs.length}</span>
        </button>
      </div>

      {/* ── 탭1: 성적 입력 매니저 ─────────────────────── */}
      {activeTab === 'input' && (
        <>
          {/* 상단 컨트롤러 */}
          <div className="flex flex-wrap items-end mb-6 bg-white p-6 rounded-[2rem] shadow-sm border border-indigo-50 gap-4">
            <div className="flex-1 min-w-[200px]">
              <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em]">클래스 및 과목 설정</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedCategoryId(''); }}
                className="border-2 border-indigo-50 rounded-xl px-4 py-2 bg-indigo-50/30 font-black text-indigo-700 outline-none text-sm">
                <option value="">클래스 선택</option>
                {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
              <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="border-2 border-rose-50 rounded-xl px-4 py-2 bg-rose-50/30 font-black text-rose-600 outline-none text-sm">
                <option value="">과목 선택</option>
                {dynamicCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border-2 border-indigo-50 rounded-xl px-4 py-2 bg-indigo-50/30 font-black text-indigo-700 outline-none text-sm">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
              </select>
              <div className="flex flex-col gap-0.5 text-center bg-amber-50/50 px-3 py-1 rounded-xl border border-amber-100">
                <span className="text-[9px] font-black text-amber-500 uppercase">Max Score</span>
                <input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="w-12 bg-transparent font-black text-amber-600 text-center outline-none text-sm" />
              </div>
            </div>
          </div>

          {selectedClassId && selectedCategoryId ? (
            <>
              <div className="mb-6 bg-white rounded-[2rem] p-6 shadow-sm border border-indigo-50">
                <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 ml-1">Learning Description</h3>
                <div className="w-full text-base font-bold text-gray-700 bg-indigo-50/10 rounded-xl p-4 border-2 border-indigo-50">
                  {subjectDescription || '클래스 관리 페이지에서 설정을 입력해주세요.'}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-xl border border-indigo-50 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-indigo-600 text-white">
                        <th className="w-[130px] py-5 px-4 text-center font-black sticky left-0 bg-indigo-600 z-30 text-base border-b-4 border-indigo-700 shadow-md">이름</th>
                        {sessionDates.map((session, i) => (
                          <th key={i} className="w-[105px] py-4 px-1 text-center border-l border-indigo-500/30 border-b-4 border-indigo-700 relative group">
                            <div className="text-lg font-black leading-none mb-1">{i + 1}회</div>
                            <div className="flex justify-center items-center">
                              <button type="button" onClick={(e) => (e.currentTarget.querySelector('input') as any)?.showPicker()}
                                className="relative flex items-center justify-center bg-indigo-500/50 hover:bg-indigo-400 text-white text-[11px] font-black w-[72px] h-[24px] rounded-full cursor-pointer transition-all">
                                {session.label}
                                <input type="date" value={session.fullDate} onChange={(e) => updateSessionDate(i, e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" />
                              </button>
                            </div>
                          </th>
                        ))}
                        <th className="w-[110px] py-5 px-4 font-black text-center border-l border-indigo-500/30 bg-indigo-800 border-b-4 border-indigo-900 text-base shadow-inner">평균</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map((student) => {
                        const validScores = student.scores.filter((s: any) => s !== '' && s !== '0').map(Number);
                        const avg = validScores.length > 0 ? (validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length).toFixed(1) : '-';
                        return (
                          <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-3 px-4 font-black text-indigo-900 text-center sticky left-0 bg-white border-r border-gray-50 text-sm z-20 whitespace-nowrap shadow-sm">{student.name}</td>
                            {student.scores.map((score: string, idx: number) => (
                              <td key={idx} className="py-2 px-1 border-l border-gray-50">
                                <input type="number" value={score} onChange={(e) => handleScoreChange(student.id, idx, e.target.value)}
                                  className="w-full border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-xl py-2.5 text-center font-black text-lg text-indigo-700 outline-none bg-gray-50/50 transition-all" placeholder="-" />
                              </td>
                            ))}
                            <td className="py-3 px-2 text-center font-black text-indigo-600 bg-indigo-50/30 text-lg italic border-l border-gray-100">{avg}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50/80 border-t-2 border-indigo-100">
                      <tr>
                        <td className="py-4 px-4 font-black text-indigo-400 text-center sticky left-0 bg-gray-50 z-20 text-[10px] uppercase italic border-r border-gray-100 shadow-sm">Class Avg</td>
                        {sessionDates.map((_, idx) => {
                          const sessionScores = students.map(s => s.scores[idx]).filter((score: any) => score !== '' && score !== '0').map(Number);
                          const sessionAvg = sessionScores.length > 0 ? (sessionScores.reduce((a: number, b: number) => a + b, 0) / sessionScores.length).toFixed(1) : '-';
                          return <td key={idx} className="py-4 px-1 text-center border-l border-gray-100 font-black text-base text-indigo-500">{sessionAvg}</td>;
                        })}
                        <td className="bg-indigo-100/30 border-l border-gray-100 font-black text-center text-indigo-600 text-base">
                          {(() => {
                            const allScores = students.flatMap(s => s.scores).filter((sc: any) => sc !== '' && sc !== '0').map(Number);
                            return allScores.length > 0 ? (allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1) : '-';
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="p-8 flex justify-between items-center bg-white border-t border-indigo-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl shadow-inner">🎯</div>
                    <div>
                      <p className="text-indigo-400 font-bold text-[9px] uppercase tracking-widest leading-none mb-1 italic">Status Report</p>
                      <p className="text-base font-black text-indigo-900">최대 점수 설정: <span className="text-amber-600 ml-1 underline underline-offset-4">{maxScore}점</span></p>
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={loading}
                    className="bg-indigo-600 text-white px-12 py-4 rounded-[1.5rem] font-black text-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-300">
                    {loading ? '저장 중...' : '성적 저장하기 ✨'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-52 bg-white rounded-[3rem] border-4 border-dashed border-indigo-100 flex flex-col items-center justify-center">
              <p className="text-2xl font-black text-indigo-200 italic uppercase tracking-tighter">Please Select Class & Subject</p>
            </div>
          )}
        </>
      )}

      {/* ── 탭2: 성적 발송 ────────────────────────────── */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 왼쪽 (2/3) */}
          <div className="lg:col-span-2 space-y-4">

            {/* 1. 클래스 선택 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">클래스 선택</h3>
              <select value={sendClassId} onChange={e => setSendClassId(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-700 outline-none focus:border-indigo-400 text-sm bg-white">
                <option value="">클래스를 선택하세요</option>
                {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>

            {/* 2. 시험 날짜 선택 */}
            {sendClassId && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-black text-gray-600 mb-3">시험 날짜 선택</h3>
                {sendAvailableSessions.length === 0 ? (
                  <p className="text-sm text-gray-400 font-bold py-2">저장된 성적 데이터가 없습니다.</p>
                ) : (
                  <select value={sendSelectedSession} onChange={e => setSendSelectedSession(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-700 outline-none focus:border-indigo-400 text-sm bg-white">
                    {sendAvailableSessions.map(date => (
                      <option key={date} value={date}>{formatSendDate(date)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 3. 학생 선택 */}
            {sendSelectedSession && sendStudents.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-gray-600">학생 선택 <span className="text-indigo-500">{sendSelectedStudentIds.size}/{sendStudents.length}명</span></h3>
                  <button onClick={toggleAllSendStudents}
                    className="text-xs font-black text-indigo-500 hover:text-indigo-700 border-2 border-indigo-100 hover:border-indigo-300 px-3 py-1 rounded-xl transition-all">
                    {sendSelectedStudentIds.size === sendStudents.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                  {sendStudents.map(s => {
                    const isSelected = sendSelectedStudentIds.has(s.id);
                    const hasGrade = sendGradeMap && Object.keys(sendGradeMap).some(k => k.startsWith(s.id));
                    return (
                      <label key={s.id}
                        className={`flex items-center gap-2 p-2.5 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSendStudent(s.id)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                        <span className="text-sm font-black text-gray-700">{s.name}</span>
                        {!hasGrade && <span className="text-[9px] text-gray-300 font-bold ml-auto">성적없음</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. 과목 선택 */}
            {sendSelectedSession && sendAvailableCategories.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-gray-600">과목 선택</h3>
                  <button onClick={() => {
                    if (sendSelectedCategoryIds.size === sendAvailableCategories.length)
                      setSendSelectedCategoryIds(new Set());
                    else
                      setSendSelectedCategoryIds(new Set(sendAvailableCategories.map(c => c.id)));
                  }} className="text-xs font-black text-indigo-500 hover:text-indigo-700 border-2 border-indigo-100 hover:border-indigo-300 px-3 py-1 rounded-xl transition-all">
                    {sendSelectedCategoryIds.size === sendAvailableCategories.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sendAvailableCategories.map(cat => {
                    const isSelected = sendSelectedCategoryIds.has(cat.id);
                    return (
                      <label key={cat.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSendCategory(cat.id)}
                          className="w-3.5 h-3.5 accent-rose-500 cursor-pointer" />
                        <span className="text-sm font-black">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽 (1/3) */}
          <div className="space-y-4">

            {/* 메시지 템플릿 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">메시지 템플릿</h3>
              <div className="flex gap-2 mb-3">
                <select
                  value={selectedGradeTemplateId}
                  onChange={e => handleGradeTemplateSelect(e.target.value)}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">템플릿 선택...</option>
                  {gradeTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                {selectedGradeTemplateId && (
                  <button
                    onClick={handleDeleteGradeTemplate}
                    className="px-3 py-2 text-xs font-black text-red-400 hover:text-red-600 border-2 border-red-100 hover:border-red-300 rounded-xl transition-all"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-bold mb-1.5">
                사용 가능 변수: <span className="text-indigo-400">{'{학원}'} {'{이름}'} {'{날짜}'}</span>
              </p>
              <textarea
                value={gradeHeaderTemplate}
                onChange={e => { setGradeHeaderTemplate(e.target.value); setSelectedGradeTemplateId(''); }}
                rows={3}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-indigo-400 focus:outline-none resize-none text-gray-700 leading-relaxed"
              />
              {!showSaveGradeTemplate ? (
                <button
                  onClick={() => setShowSaveGradeTemplate(true)}
                  className="w-full mt-2 py-2 text-xs font-black text-indigo-400 hover:text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl transition-all"
                >
                  + 현재 형식을 템플릿으로 저장
                </button>
              ) : (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="템플릿 이름..."
                    value={newGradeTemplateName}
                    onChange={e => setNewGradeTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveGradeTemplate()}
                    className="flex-1 border-2 border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={handleSaveGradeTemplate}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all">
                    저장
                  </button>
                  <button onClick={() => { setShowSaveGradeTemplate(false); setNewGradeTemplateName(''); }}
                    className="px-3 py-2 text-xs font-black text-gray-400 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all">
                    취소
                  </button>
                </div>
              )}
            </div>

            {/* 점수 형식 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">점수 표시 형식</h3>
              <label className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${sendShowMaxScore ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <input type="checkbox" checked={sendShowMaxScore} onChange={e => setSendShowMaxScore(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                <div>
                  <p className="text-sm font-black text-gray-700">점수/만점 형식으로 발송</p>
                  <p className="text-[10px] text-gray-400">{sendShowMaxScore ? '예) 영어: 80/100점' : '예) 영어: 80점'}</p>
                </div>
              </label>
            </div>

            {/* 수신자 유형 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">발송 대상</h3>
              <div className="space-y-2">
                {([
                  { value: 'parent', label: '학부모만', sub: '보호자 번호로 발송' },
                  { value: 'student', label: '학생만', sub: '학생 번호로 발송' },
                  { value: 'both', label: '학부모 + 학생 둘다', sub: '두 번호 모두 발송' },
                ] as const).map(opt => (
                  <label key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${sendRecipientType === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input type="radio" value={opt.value} checked={sendRecipientType === opt.value}
                      onChange={() => setSendRecipientType(opt.value)} className="accent-indigo-600" />
                    <div>
                      <p className="text-sm font-black text-gray-700">{opt.label}</p>
                      <p className="text-[10px] text-gray-400">{opt.sub}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 번호없음 경고 */}
            {noPhoneCount > 0 && (
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <p className="text-xs font-black text-red-500">⚠️ 번호 없음 {noPhoneCount}명 — 발송에서 제외됩니다</p>
              </div>
            )}

            {/* 메시지 미리보기 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-black text-gray-600 mb-3">
                메시지 미리보기 <span className="text-xs text-indigo-400 font-bold ml-1">{validSendPreviews.length}건</span>
              </h3>
              {!sendSelectedSession ? (
                <p className="text-sm text-gray-300 font-bold text-center py-8">클래스와 날짜를 선택하세요</p>
              ) : validSendPreviews.length === 0 ? (
                <p className="text-sm text-gray-300 font-bold text-center py-8">발송 가능한 메시지가 없습니다</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {validSendPreviews.map(p => {
                    const isLMS = p.message && getKoreanByteLength(p.message) > 90;
                    return (
                      <div key={p.studentId} className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-black text-indigo-600">{p.studentName}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-black ${isLMS ? 'bg-orange-100 text-orange-500' : 'bg-green-100 text-green-600'}`}>
                              {isLMS ? 'LMS' : 'SMS'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 font-bold">
                            {sendRecipientType === 'parent' ? p.parentPhone :
                             sendRecipientType === 'student' ? p.studentPhone :
                             [p.parentPhone, p.studentPhone].filter(Boolean).join(' / ')}
                          </span>
                        </div>
                        <p className="text-base text-gray-700 font-bold whitespace-pre-wrap leading-relaxed">{p.message}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 발송 버튼 */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">발송 가능</span>
                  <span className="font-black text-indigo-600">{validSendPreviews.length}건</span>
                </div>
                {validSendPreviews.length > 0 && (smsPricePerUnit !== null || lmsPricePerUnit !== null) && (
                  <>
                    <div className="border-t border-gray-100 pt-1.5">
                      {sendConBreakdown.smsCount > 0 && smsPricePerUnit !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">SMS × {sendConBreakdown.smsCount}건</span>
                          <span className="font-black text-yellow-600">{(sendConBreakdown.smsCount * smsPricePerUnit).toLocaleString()} C</span>
                        </div>
                      )}
                      {sendConBreakdown.lmsCount > 0 && lmsPricePerUnit !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">LMS × {sendConBreakdown.lmsCount}건</span>
                          <span className="font-black text-yellow-600">{(sendConBreakdown.lmsCount * lmsPricePerUnit).toLocaleString()} C</span>
                        </div>
                      )}
                      {sendConBreakdown.total !== null && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="font-black text-gray-700">합계</span>
                          <span className="font-black text-yellow-500 text-base">{sendConBreakdown.total.toLocaleString()} C</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setSendShowConfirmModal(true)}
                disabled={sendIsSending || validSendPreviews.length === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-base rounded-2xl transition-all active:scale-95 disabled:cursor-not-allowed">
                {sendIsSending ? '발송 중...' : `📤 ${validSendPreviews.length}건 발송하기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 탭3: 발송 이력 ────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-700">발송 이력</h2>
              <p className="text-xs text-gray-400 mt-0.5">성적 SMS 발송 기록</p>
            </div>
            {selectedGradeLogIds.size > 0 && (
              <button onClick={handleDeleteGradeLogs} disabled={isDeletingGradeLogs}
                className="px-4 py-2 text-xs font-black text-red-500 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-xl transition-all disabled:opacity-50">
                {isDeletingGradeLogs ? '삭제 중...' : `선택 ${selectedGradeLogIds.size}건 삭제`}
              </button>
            )}
          </div>
          {gradeLogs.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-400 font-bold">발송 이력이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input type="checkbox" checked={allGradeLogsSelected} onChange={toggleSelectAllGradeLogs}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-black text-gray-400">발송일시</th>
                    <th className="py-3 px-4 text-left text-xs font-black text-gray-400">내용 미리보기</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">수신 유형</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">SMS/LMS</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">사용 CON</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">수신자</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">성공</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">실패</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">상세</th>
                    <th className="py-3 px-4 text-center text-xs font-black text-gray-400">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeLogs.map(log => {
                    const date = new Date(log.created_at);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    const typeLabel = log.recipient_type === 'kiosk' ? '키오스크' : log.recipient_type === 'parent' ? '보호자' : log.recipient_type === 'student' ? '학생' : '전체';
                    const typeCls = log.recipient_type === 'kiosk' ? 'bg-emerald-100 text-emerald-600' : log.recipient_type === 'parent' ? 'bg-blue-100 text-blue-600' : log.recipient_type === 'student' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600';
                    const msgType = log.message ? (getKoreanByteLength(log.message) > 90 ? 'LMS' : 'SMS') : 'SMS';
                    const pricePerUnit = msgType === 'LMS' ? lmsPricePerUnit : smsPricePerUnit;
                    const conUsed = pricePerUnit !== null ? pricePerUnit * (log.success_count || 0) : null;
                    return (
                      <tr key={log.id} className={`border-b border-gray-50 transition-colors ${selectedGradeLogIds.has(log.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        <td className="py-3 px-4">
                          <input type="checkbox" checked={selectedGradeLogIds.has(log.id)} onChange={() => toggleSelectGradeLog(log.id)}
                            className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-gray-500 whitespace-nowrap">{dateStr}</td>
                        <td className="py-3 px-4 max-w-[200px]">
                          <span className="text-sm text-gray-700 font-bold truncate block">{log.message}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${typeCls}`}>{typeLabel}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${msgType === 'LMS' ? 'bg-orange-100 text-orange-500' : 'bg-green-100 text-green-600'}`}>
                            {msgType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-yellow-600 text-xs">
                          {conUsed !== null ? `${conUsed.toLocaleString()} C` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-black text-gray-600">{log.total_count}</td>
                        <td className="py-3 px-4 text-center font-black text-green-500">{log.success_count}</td>
                        <td className="py-3 px-4 text-center font-black text-red-400">{log.fail_count || 0}</td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => setSelectedGradeLog(log)}
                            className="px-3 py-1.5 text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all">
                            상세
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => handleDeleteSingleGradeLog(log.id)}
                            className="px-3 py-1.5 text-xs font-black text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-all">
                            삭제
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

      {/* ── 성적 발송 확인 모달 ─────────────────────────── */}
      {sendShowConfirmModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800">발송 확인</h3>
              <p className="text-sm text-gray-400 mt-1">아래 내용을 확인 후 발송해주세요</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-indigo-50 rounded-2xl p-4">
                <p className="text-xs font-black text-indigo-400 mb-1">발송 요약</p>
                <p className="text-sm font-bold text-indigo-800">
                  {formatSendDate(sendSelectedSession)} 성적 · {validSendPreviews.length}건 발송
                  {noPhoneCount > 0 && <span className="text-red-400 ml-2">({noPhoneCount}명 번호없음 제외)</span>}
                </p>
              </div>
              {sendConBreakdown.total !== null && sendConBreakdown.total > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-1">
                  <p className="text-xs font-black text-yellow-700">⭐ CON 차감 안내</p>
                  {sendConBreakdown.smsCount > 0 && smsPricePerUnit !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-700 font-bold">SMS × {sendConBreakdown.smsCount}건</span>
                      <span className="font-black text-yellow-800">{(sendConBreakdown.smsCount * smsPricePerUnit).toLocaleString()} C</span>
                    </div>
                  )}
                  {sendConBreakdown.lmsCount > 0 && lmsPricePerUnit !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-700 font-bold">LMS × {sendConBreakdown.lmsCount}건</span>
                      <span className="font-black text-yellow-800">{(sendConBreakdown.lmsCount * lmsPricePerUnit).toLocaleString()} C</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-yellow-200 pt-1">
                    <span className="font-black text-yellow-800">합계</span>
                    <span className="font-black text-yellow-900 text-base">{sendConBreakdown.total.toLocaleString()} CON 차감 예정</span>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-black text-gray-400 mb-2">수신자별 메시지</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validSendPreviews.map(p => (
                    <div key={p.studentId} className="bg-gray-50 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-black text-indigo-600">{p.studentName}</span>
                        <span className="text-xs text-gray-400 font-bold">
                          {sendRecipientType === 'parent' ? p.parentPhone :
                           sendRecipientType === 'student' ? p.studentPhone :
                           [p.parentPhone, p.studentPhone].filter(Boolean).join(' / ')}
                        </span>
                      </div>
                      <p className="text-base text-gray-700 font-bold whitespace-pre-wrap">{p.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setSendShowConfirmModal(false)}
                className="flex-1 py-3 font-black text-gray-500 border-2 border-gray-200 rounded-2xl hover:border-gray-300 transition-all">
                취소
              </button>
              <button onClick={handleGradeSend}
                className="flex-1 py-3 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all active:scale-95">
                📤 발송하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 발송 이력 상세 모달 ─────────────────────────── */}
      {selectedGradeLog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800">발송 상세</h3>
                <button onClick={() => { setSelectedGradeLog(null); setSelectedGradeRecipient(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(selectedGradeLog.created_at).toLocaleString('ko-KR')}</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-black text-gray-400 mb-1">
                  {selectedGradeRecipient ? `${selectedGradeRecipient.name}에게 발송된 메시지` : '메시지 내용'}
                </p>
                <p className="text-sm text-gray-700 font-bold whitespace-pre-wrap">
                  {selectedGradeRecipient?.message || selectedGradeLog.message}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-2xl font-black text-gray-700">{selectedGradeLog.total_count}</p>
                  <p className="text-xs text-gray-400 font-bold mt-1">전체</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-3">
                  <p className="text-2xl font-black text-green-500">{selectedGradeLog.success_count}</p>
                  <p className="text-xs text-green-400 font-bold mt-1">성공</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-3">
                  <p className="text-2xl font-black text-red-400">{selectedGradeLog.fail_count || 0}</p>
                  <p className="text-xs text-red-400 font-bold mt-1">실패</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 mb-2">수신자 상세 {selectedGradeRecipient && <span className="text-indigo-400 font-bold">— 클릭하여 메시지 확인</span>}</p>
                <div className="space-y-1.5">
                  {(selectedGradeLog.recipients || []).map((r: any, i: number) => {
                    const isSelected = selectedGradeRecipient === r;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedGradeRecipient((prev: any) => prev === r ? null : r)}
                        className={`flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer transition-all border-2
                          ${isSelected
                            ? 'border-indigo-300 bg-indigo-50'
                            : r.status === 'success'
                              ? 'border-transparent bg-green-50 hover:border-indigo-200'
                              : 'border-transparent bg-red-50 hover:border-indigo-200'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          <span className="text-sm font-black text-gray-700">{r.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500 font-bold">{r.phone}</span>
                          {r.error && <p className="text-[10px] text-red-400 font-bold">{r.error}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 발송 결과 토스트 ─────────────────────────────── */}
      {sendShowResultToast && sendResult && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
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

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; border: 2px solid #f8fafc; }
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
