'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GradeInputPage() {
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

  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase.from('classes').select('*').order('class_name');
      if (data) setClassList(data);
    }
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!selectedClassId || classList.length === 0) {
      setStudents([]); setSessionDates([]); setSubjectDescription(''); return;
    }
    
    const currentClass = classList.find(c => c.id.toString() === selectedClassId);
    
    if (currentClass) {
      const cats = Array.isArray(currentClass.test_categories) ? currentClass.test_categories : [];
      setDynamicCategories(cats);

      if (selectedCategoryId) {
        const activeDays = [];
        if (currentClass.sun) activeDays.push(0);
        if (currentClass.mon) activeDays.push(1);
        if (currentClass.tue) activeDays.push(2);
        if (currentClass.wed) activeDays.push(3);
        if (currentClass.thu) activeDays.push(4);
        if (currentClass.fri) activeDays.push(5);
        if (currentClass.sat) activeDays.push(6);
        
        const currentCat = cats.find((c: any) => c.id === selectedCategoryId);
        
        fetchData(selectedClassId, selectedMonth, selectedCategoryId, currentCat?.name || '', activeDays);
        setSubjectDescription(currentCat?.description || '');
        fetchMaxScore(selectedMonth, selectedCategoryId);
      }
    }
  }, [selectedClassId, selectedMonth, selectedCategoryId, classList]);

  const fetchMaxScore = async (month: number, catId: string) => {
    const { data } = await supabase.from('grades').select('max_score').eq('subject_id', catId).filter('test_name', 'ilike', `% ${month}월%`).limit(1).maybeSingle();
    if (data?.max_score) setMaxScore(data.max_score);
    else setMaxScore(100);
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
  };

  const fetchData = async (classId: string, month: number, catId: string, catName: string, targetDays: number[]) => {
    setLoading(true);
    try {
      const year = 2026;
      const currentClassObj = classList.find(c => c.id.toString() === classId);
      const targetClassName = currentClassObj?.class_name || "";
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

      const { data: studentData } = await supabase.from('students').select('*').eq('class_name', targetClassName);
      
      // ✅ 중요: test_name 대신 subject_id를 우선하여 데이터 조회
      const { data: allGradeData } = await supabase
        .from('grades')
        .select('*')
        .eq('subject_id', catId);

      if (studentData) {
        const sortedStudents = [...studentData].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        const formatted = sortedStudents.map(student => {
          const scores = Array(actualSessions.length).fill('');
          actualSessions.forEach((session, i) => {
            // ✅ 이름이 바뀌어도 "n월 n회차"라는 패턴만 맞으면 데이터를 가져오도록 매칭 로직 강화
            const found = allGradeData?.find(g => 
              g.student_id === student.id && 
              g.test_name.includes(`${month}월 ${i + 1}회차`)
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
    } finally { setLoading(false); }
  };

  const updateSessionDate = (idx: number, newFullDate: string) => {
    const updatedSessions = [...sessionDates];
    updatedSessions[idx] = { label: formatShortDate(newFullDate), fullDate: newFullDate };
    updatedSessions.sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    setSessionDates(updatedSessions);
  };

  const handleScoreChange = (studentId: string, idx: number, value: string) => {
    if (value === '') {
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, scores: s.scores.map((v:any, i:number) => i === idx ? '' : v) } : s));
      return;
    }
    const num = Number(value);
    if (num < 0 || num > maxScore) return; 
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, scores: s.scores.map((v:any, i:number) => i === idx ? value : v) } : s));
  };

  const handleSave = async () => {
    if (!selectedCategoryId) return alert("과목 선택 필수!");
    setLoading(true);
    const currentCat = dynamicCategories.find(c => c.id === selectedCategoryId);
    const catName = currentCat?.name || '과목';
    const upsertGrades: any[] = [];
    sessionDates.forEach((session, idx) => {
      students.forEach(student => {
        const score = student.scores[idx];
        upsertGrades.push({
          student_id: student.id,
          subject_id: selectedCategoryId, 
          test_name: `[${catName}] ${selectedMonth}월 ${idx + 1}회차`,
          score: score === '' ? 0 : parseInt(score),
          test_date: session.fullDate,
          max_score: maxScore,
        });
      });
    });
    try {
      if (upsertGrades.length > 0) {
        const { error } = await supabase.from('grades').upsert(upsertGrades, { onConflict: 'student_id, test_name' });
        if (error) throw error;
      }
      alert(`성적이 성공적으로 저장되었습니다! ✅`);
    } catch (err) { alert("저장 중 오류 발생"); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-[98%] mx-auto py-10 px-4 font-sans tracking-tight bg-slate-50 min-h-screen">
      {/* 상단 컨트롤 */}
      <div className="flex flex-wrap items-end mb-6 bg-white p-6 rounded-[2rem] shadow-sm border border-indigo-50 gap-4">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-black text-indigo-900 mb-1 italic">성적 입력 매니저</h1>
          <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-[0.2em]">Academic Records System</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedCategoryId(''); }} className="border-2 border-indigo-50 rounded-xl px-4 py-2 bg-indigo-50/30 font-black text-indigo-700 outline-none text-sm">
            <option value="">클래스 선택</option>
            {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
          </select>
          <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="border-2 border-rose-50 rounded-xl px-4 py-2 bg-rose-50/30 font-black text-rose-600 outline-none text-sm">
            <option value="">과목 선택</option>
            {dynamicCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="border-2 border-indigo-50 rounded-xl px-4 py-2 bg-indigo-50/30 font-black text-indigo-700 outline-none text-sm">
            {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}월</option>)}
          </select>
          <div className="flex flex-col gap-0.5 text-center bg-amber-50/50 px-3 py-1 rounded-xl border border-amber-100">
            <span className="text-[9px] font-black text-amber-500 uppercase">Max Score</span>
            <input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="w-12 bg-transparent font-black text-amber-600 text-center outline-none text-sm" />
          </div>
        </div>
      </div>

      {selectedClassId && selectedCategoryId ? (
        <>
          <div className="mb-6 bg-white rounded-[2rem] p-6 shadow-sm border border-indigo-50">
            <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 ml-1">Learning Description</h3>
            <div className="w-full text-base font-bold text-gray-700 bg-indigo-50/10 rounded-xl p-4 border-2 border-indigo-50 italic">
              {subjectDescription || "클래스 관리 페이지에서 설정을 입력해주세요."}
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
                        <div className="text-lg font-black leading-none mb-1">{i+1}회</div>
                        <div className="flex justify-center items-center">
                          <button type="button" onClick={(e) => (e.currentTarget.querySelector('input') as any)?.showPicker()} className="relative flex items-center justify-center bg-indigo-500/50 hover:bg-indigo-400 text-white text-[11px] font-black w-[72px] h-[24px] rounded-full cursor-pointer transition-all">
                            {session.label}
                            <input type="date" value={session.fullDate} onChange={(e) => updateSessionDate(i, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" />
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
                            <input type="number" value={score} onChange={(e) => handleScoreChange(student.id, idx, e.target.value)} className="w-full border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-xl py-2.5 text-center font-black text-lg text-indigo-700 outline-none bg-gray-50/50 transition-all" placeholder="-" />
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
                      const sessionScores = students.map(s => s.scores[idx]).filter(score => score !== '' && score !== '0').map(Number);
                      const sessionAvg = sessionScores.length > 0 ? (sessionScores.reduce((a: number, b: number) => a + b, 0) / sessionScores.length).toFixed(1) : '-';
                      return ( <td key={idx} className="py-4 px-1 text-center border-l border-gray-100 font-black text-base text-indigo-500">{sessionAvg}</td> );
                    })}
                    <td className="bg-indigo-100/30 border-l border-gray-100 font-black text-center text-indigo-600 text-base">
                      {(() => {
                        const allScores = students.flatMap(s => s.scores).filter(sc => sc !== '' && sc !== '0').map(Number);
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
              <button onClick={handleSave} disabled={loading} className="bg-indigo-600 text-white px-12 py-4 rounded-[1.5rem] font-black text-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-300">
                {loading ? "저장 중..." : "성적 저장하기 ✨"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-52 bg-white rounded-[3rem] border-4 border-dashed border-indigo-100 flex flex-col items-center justify-center">
          <p className="text-2xl font-black text-indigo-200 italic uppercase tracking-tighter">Please Select Class & Subject</p>
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