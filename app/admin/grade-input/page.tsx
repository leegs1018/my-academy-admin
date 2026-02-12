'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GradeInputPage() {
  const [classList, setClassList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [maxScore, setMaxScore] = useState(100);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(''); 
  
  const [subjectDescription, setSubjectDescription] = useState('');
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. 초기 클래스 목록 로딩
  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase.from('classes').select('*').order('class_name');
      if (data) setClassList(data);
    }
    fetchClasses();
  }, []);

  // 2. 과목 설명 로딩
  const fetchDescription = async (classId: string, category: string) => {
    if (!category) return;
    const { data } = await supabase
      .from('subject_descriptions')
      .select('description')
      .eq('class_id', classId)
      .eq('category', category)
      .maybeSingle();

    setSubjectDescription(data?.description || '');
  };

  // 3. 필터 변경 시 처리 (클래스, 월, 과목 변경 감지)
  useEffect(() => {
    if (!selectedClassId || classList.length === 0) {
      setStudents([]);
      setSessionDates([]);
      setSubjectDescription('');
      return;
    }
    
    const currentClass = classList.find(c => c.id.toString() === selectedClassId);
    if (currentClass) {
      const cats = currentClass.test_categories?.length > 0 ? currentClass.test_categories : ['단어', '듣기', '본시험'];
      setDynamicCategories(cats);

      if (selectedCategory) {
        const activeDays: number[] = [];
        if (currentClass.sun) activeDays.push(0);
        if (currentClass.mon) activeDays.push(1);
        if (currentClass.tue) activeDays.push(2);
        if (currentClass.wed) activeDays.push(3);
        if (currentClass.thu) activeDays.push(4);
        if (currentClass.fri) activeDays.push(5);
        if (currentClass.sat) activeDays.push(6);

        const targetDays = activeDays.length > 0 ? activeDays : [1, 3, 5];
        const year = 2026;
        const defaultDates: string[] = [];
        const lastDay = new Date(year, selectedMonth, 0).getDate();

        for (let d = 1; d <= lastDay; d++) {
          const dateObj = new Date(year, selectedMonth - 1, d);
          if (targetDays.includes(dateObj.getDay())) {
            defaultDates.push(`${selectedMonth}/${d}`);
          }
        }

        fetchData(selectedClassId, selectedMonth, selectedCategory, defaultDates);
        fetchDescription(selectedClassId, selectedCategory);
      } else {
        setStudents([]);
        setSessionDates([]);
        setSubjectDescription('');
      }
    }
  }, [selectedClassId, selectedMonth, selectedCategory, classList]);

  // 4. 데이터 로딩
  const fetchData = async (classId: string, month: number, category: string, defaultDates: string[]) => {
    setLoading(true);
    const currentClassObj = classList.find(c => c.id.toString() === classId);
    const targetClassName = currentClassObj?.class_name;
    if (!targetClassName) { setLoading(false); return; }

    const { data: studentData } = await supabase.from('students').select('*').eq('class_name', targetClassName);
    const { data: allGradeData } = await supabase.from('grades').select('*').filter('test_name', 'ilike', `% ${month}월%`);

    if (studentData) {
      const sortedStudents = [...studentData].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const restoredDates = [...defaultDates];

      const currentCategoryGrades = allGradeData?.filter(g => g.test_name.startsWith(`[${category}]`));
      
      if (currentCategoryGrades && currentCategoryGrades.length > 0) {
        const savedMax = currentCategoryGrades.find(g => g.max_score !== null)?.max_score;
        if (savedMax) setMaxScore(savedMax);
      } else {
        setMaxScore(100);
      }

      defaultDates.forEach((_, i) => {
        const testNamePart = `${month}월 ${i + 1}회차`;
        const savedEntry = allGradeData?.find(g => g.test_name.includes(testNamePart) && g.test_date);
        
        if (savedEntry) {
          const dateParts = savedEntry.test_date.split('-');
          const lastPart = dateParts[dateParts.length - 1];
          restoredDates[i] = isNaN(Number(lastPart)) ? lastPart : `${month}/${lastPart}`;
        }
      });

      const formatted = sortedStudents.map(student => {
        const scores = Array(defaultDates.length).fill('');
        defaultDates.forEach((_, i) => {
          const testName = `[${category}] ${month}월 ${i + 1}회차`;
          const found = allGradeData?.find(g => g.student_id === student.id && g.test_name === testName);
          if (found && found.score !== null) scores[i] = found.score.toString();
        });
        return { ...student, scores };
      });

      setSessionDates(restoredDates);
      setStudents(formatted);
    }
    setLoading(false);
  };

  const handleScoreChange = (studentId: string, idx: number, value: string) => {
    if (value !== '' && (Number(value) < 0 || Number(value) > maxScore)) return;
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, scores: s.scores.map((v: any, i: number) => i === idx ? value : v) } : s));
  };

  const handleDateChange = (idx: number, newVal: string) => {
    const updated = [...sessionDates];
    updated[idx] = newVal;
    setSessionDates(updated);
  };

  const handleSave = async () => {
    if (!selectedCategory) return alert("과목을 선택해주세요.");
    if (!confirm(`${selectedMonth}월 [${selectedCategory}] 데이터를 저장하시겠습니까?\n(적용 만점: ${maxScore}점)`)) return;
    
    setLoading(true);
    const upsertGrades: any[] = [];
    
    sessionDates.forEach((rawDate, idx) => {
      const formattedDate = rawDate.includes('/') 
        ? `2026-${rawDate.replace('/', '-')}` 
        : `2026-${selectedMonth}-${rawDate}`;

      const isSpecialDay = isNaN(Number(rawDate.replace('/', '')));

      students.forEach(student => {
        const score = student.scores[idx];
        if (score !== '' || isSpecialDay) {
          upsertGrades.push({
            student_id: student.id,
            test_name: `[${selectedCategory}] ${selectedMonth}월 ${idx + 1}회차`,
            score: score !== '' ? parseInt(score) : 0,
            test_date: formattedDate,
            max_score: maxScore,
          });
        }
      });
    });

    try {
      if (upsertGrades.length > 0) {
        const { error: gradeError } = await supabase.from('grades').upsert(upsertGrades, { onConflict: 'student_id, test_name' });
        if (gradeError) throw gradeError;

        for (let i = 0; i < sessionDates.length; i++) {
          const testNamePart = `${selectedMonth}월 ${i + 1}회차`;
          const syncDate = sessionDates[i].includes('/') 
            ? `2026-${sessionDates[i].replace('/', '-')}` 
            : `2026-${selectedMonth}-${sessionDates[i]}`;

          await supabase.from('grades').update({ test_date: syncDate }).filter('test_name', 'ilike', `%${testNamePart}`);
        }
      }

      await supabase.from('subject_descriptions').upsert({
        class_id: selectedClassId,
        category: selectedCategory,
        description: subjectDescription
      }, { onConflict: 'class_id, category' });

      alert(`성공적으로 저장되었습니다! ✅`);
    } catch (error: any) {
      alert(`저장 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[98%] mx-auto py-10 px-4 font-sans tracking-tight">
      {/* 상단 컨트롤러 */}
      <div className="flex flex-wrap items-end mb-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-indigo-50 gap-8">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-3xl font-black text-indigo-900 mb-1 italic">성적 입력 매니저</h1>
          <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest">Attendance & Performance</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-indigo-300 ml-1 uppercase">Class</span>
            <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedCategory(''); }} className="border-2 border-indigo-50 rounded-2xl px-5 py-3 bg-indigo-50/30 font-black text-indigo-700 outline-none focus:border-indigo-200 transition-all">
              <option value="">클래스 선택</option>
              {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-rose-300 ml-1 uppercase">Subject</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="border-2 border-rose-50 rounded-2xl px-5 py-3 bg-rose-50/30 font-black text-rose-600 outline-none focus:border-rose-200 transition-all">
              <option value="">과목 선택</option>
              {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-indigo-300 ml-1 uppercase">Month</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="border-2 border-indigo-50 rounded-2xl px-5 py-3 bg-indigo-50/30 font-black text-indigo-700 outline-none">
              {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}월</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-amber-500 ml-1 uppercase font-sans">Max Score</span>
            <input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="w-24 border-2 border-amber-100 rounded-2xl px-5 py-3 bg-amber-50/30 font-black text-amber-600 outline-none text-center focus:bg-white transition-all" />
          </div>
        </div>
      </div>

      {selectedClassId && selectedCategory ? (
        <>
          <div className="mb-6">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-[2px] rounded-[2.5rem] shadow-lg shadow-indigo-100">
              <div className="bg-white rounded-[2.4rem] p-8 flex items-start gap-6">
                <div className="bg-indigo-50 text-indigo-600 w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shrink-0 shadow-inner">📚</div>
                <div className="flex-1">
                  <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-3 ml-1">학습 과제 설명 [{selectedCategory}]</h3>
                  <textarea rows={4} value={subjectDescription} onChange={(e) => setSubjectDescription(e.target.value)} placeholder="이번 달 학습 목표나 평가 기준을 입력하세요." className="w-full text-lg font-bold text-gray-700 outline-none bg-indigo-50/10 rounded-2xl p-4 border-2 border-transparent focus:border-indigo-50 transition-all resize-none leading-relaxed" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] shadow-2xl border border-indigo-50 overflow-hidden">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="py-8 px-8 text-left font-black sticky left-0 bg-indigo-600 z-30 text-xl border-b-4 border-indigo-700 min-w-[180px] shadow-md">이름</th>
                    {sessionDates.map((date, i) => (
                      <th key={i} className="py-6 px-4 text-center border-l border-indigo-500/30 border-b-4 border-indigo-700 min-w-[130px]">
                        <div className="text-2xl font-black mb-1 font-sans">{i+1}회</div>
                        <input type="text" value={date} onChange={(e) => handleDateChange(i, e.target.value)} className="bg-indigo-500/40 text-xs font-bold text-white text-center w-20 rounded-lg outline-none border border-indigo-400 focus:bg-white focus:text-indigo-600 transition-all py-1" />
                      </th>
                    ))}
                    <th className="py-8 px-8 font-black text-center border-l border-indigo-500/30 bg-indigo-800 border-b-4 border-indigo-900 text-xl">평균</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map((student) => {
                    const validScores = student.scores.filter((s: any) => s !== '').map(Number);
                    const avg = validScores.length > 0 ? (validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length).toFixed(1) : '-';
                    return (
                      <tr key={student.id} className="hover:bg-indigo-50/30 group transition-colors">
                        <td className="py-6 px-8 font-black text-indigo-900 sticky left-0 bg-white border-r border-gray-50 text-lg z-20 shadow-sm">{student.name}</td>
                        {student.scores.map((score: string, idx: number) => (
                          <td key={idx} className="py-4 px-3 border-l border-gray-50">
                            <input type="number" value={score} onChange={(e) => handleScoreChange(student.id, idx, e.target.value)} className="w-full bg-gray-50/50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-[1.2rem] py-4 text-center font-black text-2xl text-indigo-700 outline-none transition-all placeholder-gray-200" placeholder="-" />
                          </td>
                        ))}
                        <td className="py-6 px-8 text-center font-black text-indigo-600 bg-indigo-50/30 text-3xl italic border-l border-gray-100 font-sans">{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* [추가] 회차별 평균 행 */}
                <tfoot className="bg-indigo-50/50 border-t-2 border-indigo-100">
                  <tr className="bg-gray-50/80">
                    <td className="py-6 px-8 font-black text-indigo-400 sticky left-0 bg-gray-50 z-20 text-lg shadow-sm border-r border-gray-100">CLASS AVG</td>
                    {sessionDates.map((_, idx) => {
                      const sessionScores = students.map(s => s.scores[idx]).filter(score => score !== '').map(Number);
                      const sessionAvg = sessionScores.length > 0 
                        ? (sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length).toFixed(1) 
                        : '-';
                      return (
                        <td key={idx} className="py-6 px-3 text-center border-l border-gray-100 font-black text-2xl text-indigo-500 font-sans">
                          {sessionAvg}
                        </td>
                      );
                    })}
                    <td className="bg-indigo-100/30 border-l border-gray-100"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="p-10 flex flex-col md:flex-row justify-between items-center bg-white border-t border-indigo-50 gap-6">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></span>
                  <p className="text-indigo-400 font-bold italic text-sm">현재 설정된 만점 기준: <span className="text-amber-600 font-black">{maxScore}점</span></p>
                </div>
                <button onClick={handleSave} disabled={loading} className="bg-indigo-600 text-white px-20 py-5 rounded-[2rem] font-black text-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-300">
                  {loading ? "저장 중..." : "데이터 저장하기 ✨"}
                </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-52 bg-white rounded-[4rem] border-4 border-dashed border-indigo-50 shadow-inner flex flex-col items-center justify-center">
            <div className="text-6xl mb-6 opacity-20">📊</div>
            <p className="text-3xl font-black text-indigo-200 italic uppercase tracking-tighter">
              {selectedClassId ? "Please Select a Subject to Start" : "Please Select a Class First"}
            </p>
        </div>
      )}
    </div>
  );
}