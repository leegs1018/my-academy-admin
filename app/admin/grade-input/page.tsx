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

  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase.from('classes').select('*').order('class_name');
      if (data) setClassList(data);
    }
    fetchClasses();
  }, []);

  const fetchDescription = async (classId: string, category: string) => {
    const { data } = await supabase
      .from('subject_descriptions')
      .select('description')
      .eq('class_id', classId)
      .eq('category', category)
      .maybeSingle();

    setSubjectDescription(data?.description || '');
  };

  useEffect(() => {
    if (!selectedClassId || classList.length === 0) return;
    
    const currentClass = classList.find(c => c.id.toString() === selectedClassId);
    if (currentClass) {
      const cats = currentClass.test_categories?.length > 0 ? currentClass.test_categories : ['단어', '듣기', '본시험'];
      setDynamicCategories(cats);
      const targetCategory = selectedCategory || cats[0];
      if (!selectedCategory) setSelectedCategory(targetCategory);

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

      fetchData(selectedClassId, selectedMonth, targetCategory, defaultDates);
      fetchDescription(selectedClassId, targetCategory);
    }
  }, [selectedClassId, selectedMonth, selectedCategory, classList]);

  const fetchData = async (classId: string, month: number, category: string, defaultDates: string[]) => {
    setLoading(true);
    const currentClassObj = classList.find(c => c.id.toString() === classId);
    const targetClassName = currentClassObj?.class_name;
    if (!targetClassName) { setLoading(false); return; }

    const { data: studentData } = await supabase.from('students').select('*').eq('class_name', targetClassName);
    const { data: gradeData } = await supabase.from('grades').select('*').filter('test_name', 'ilike', `[${category}] ${month}월%`);

    if (studentData) {
      const sortedStudents = [...studentData].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      
      // 날짜 복원 로직 개선
      const restoredDates = [...defaultDates];

      const formatted = sortedStudents.map(student => {
        const scores = Array(defaultDates.length).fill('');
        defaultDates.forEach((_, i) => {
          const testName = `[${category}] ${month}월 ${i + 1}회차`;
          const found = gradeData?.find(g => g.student_id === student.id && g.test_name === testName);
          
          if (found) {
            scores[i] = found.score.toString();
            
            if (found.test_date) {
              const dateParts = found.test_date.split('-');
              const lastPart = dateParts[dateParts.length - 1]; // '설날' 또는 '12'

              // 한글이면 그대로, 숫자면 '월/일' 형식으로 복원
              if (isNaN(Number(lastPart))) {
                restoredDates[i] = lastPart; 
              } else {
                restoredDates[i] = `${month}/${lastPart}`;
              }
            }
          }
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

  const getColumnAverage = (colIdx: number) => {
    const validScores = students.map(s => s.scores[colIdx]).filter(score => score !== '').map(Number);
    if (validScores.length === 0) return '-';
    return (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1);
  };

  const handleSave = async () => {
    if (!confirm(`${selectedMonth}월 [${selectedCategory}] 성적과 설명을 저장하시겠습니까?`)) return;
    setLoading(true);
    
    const upsertGrades: any[] = [];
    students.forEach(student => {
      student.scores.forEach((score: string, idx: number) => {
        if (score !== '') {
          const rawDate = sessionDates[idx];
          // 저장 시 형식을 '2026-월-값'으로 통일
          const formattedDate = rawDate.includes('/') 
            ? `2026-${rawDate.replace('/', '-')}` 
            : `2026-${selectedMonth}-${rawDate}`;

          upsertGrades.push({
            student_id: student.id,
            test_name: `[${selectedCategory}] ${selectedMonth}월 ${idx + 1}회차`,
            score: parseInt(score),
            test_date: formattedDate,
            max_score: maxScore,
          });
        }
      });
    });

    const descriptionData = {
      class_id: selectedClassId,
      category: selectedCategory,
      description: subjectDescription
    };

    const [gradeRes, descRes] = await Promise.all([
      supabase.from('grades').upsert(upsertGrades, { onConflict: 'student_id, test_name' }),
      supabase.from('subject_descriptions').upsert(descriptionData, { onConflict: 'class_id, category' })
    ]);

    if (gradeRes.error || descRes.error) alert('저장 실패: ' + (gradeRes.error?.message || descRes.error?.message));
    else alert(`저장되었습니다! ✅`);
    setLoading(false);
  };

  return (
    <div className="max-w-[98%] mx-auto py-10 px-4">
      {/* 필터 영역 */}
      <div className="flex flex-wrap items-end mb-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-indigo-50 gap-8">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-3xl font-black text-indigo-900 mb-1 tracking-tight italic">성적 입력 매니저</h1>
          <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest">Attendance & Performance</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-indigo-300 ml-1">CLASS</span>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="border-2 border-indigo-50 rounded-2xl px-5 py-3 bg-indigo-50/30 font-black text-indigo-700 outline-none">
              <option value="">선택</option>
              {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-rose-300 ml-1">SUBJECT</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="border-2 border-rose-50 rounded-2xl px-5 py-3 bg-rose-50/30 font-black text-rose-600 outline-none">
              {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-indigo-300 ml-1">MONTH</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="border-2 border-indigo-50 rounded-2xl px-5 py-3 bg-indigo-50/30 font-black text-indigo-700 outline-none">
              {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}월</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-amber-500 ml-1">MAX SCORE</span>
            <input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="w-24 border-2 border-amber-100 rounded-2xl px-5 py-3 bg-amber-50/30 font-black text-amber-600 outline-none text-center" />
          </div>
        </div>
      </div>

      {/* 과목 설명란 섹션 */}
      {selectedClassId && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-[2px] rounded-[2.5rem] shadow-lg">
            <div className="bg-white rounded-[2.4rem] p-8 flex items-start gap-6">
              <div className="bg-indigo-100 text-indigo-600 w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-inner shrink-0">
                📚
              </div>
              <div className="flex-1">
                <h3 className="text-s font-black text-indigo-400 uppercase tracking-widest mb-3 ml-1">학습 과제 설명</h3>
                <textarea 
                  rows={5}
                  value={subjectDescription}
                  onChange={(e) => setSubjectDescription(e.target.value)}
                  placeholder={`이번 달 학습 목표를 입력하세요.\n1. 교재 1~3단원 핵심 문법 정리\n2. 주차별 단어 200개 암기 및 테스트\n3. 서술형 대비 문장 구조 파악 훈련`}
                  className="w-full text-lg font-bold text-gray-700 outline-none placeholder:text-gray-300 bg-indigo-50/20 rounded-2xl p-4 border-2 border-transparent focus:border-indigo-100 transition-all resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedClassId ? (
        <div className="bg-white rounded-[3rem] shadow-2xl border border-indigo-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-auto">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="py-8 px-8 text-left font-black sticky left-0 bg-indigo-600 z-20 text-xl border-b-4 border-indigo-700 min-w-[160px] whitespace-nowrap shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                    이름
                  </th>
                  {sessionDates.map((date, i) => (
                    <th key={i} className="py-6 px-2 text-center border-l border-indigo-500/50 border-b-4 border-indigo-700 min-w-[120px]">
                      <div className="text-2xl font-black mb-1 leading-none">{i+1}회</div>
                      <input 
                        type="text" 
                        value={date} 
                        onChange={(e) => handleDateChange(i, e.target.value)}
                        className="bg-indigo-500/50 text-[13px] font-bold text-white text-center w-20 rounded-lg outline-none border border-indigo-400 focus:bg-white focus:text-indigo-600 transition-all px-1"
                      />
                    </th>
                  ))}
                  <th className="py-8 px-8 font-black text-center border-l border-indigo-500/50 bg-indigo-700 border-b-4 border-indigo-800 text-xl whitespace-nowrap">평균</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => {
                  const validScores = student.scores.filter((s: any) => s !== '').map(Number);
                  const average = validScores.length > 0 ? (validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length).toFixed(1) : '-';
                  return (
                    <tr key={student.id} className="hover:bg-indigo-50/20 group transition-colors">
                      <td className="py-6 px-8 font-black text-indigo-900 sticky left-0 bg-white border-r border-gray-50 text-lg group-hover:bg-indigo-50 transition-all min-w-[160px] whitespace-nowrap z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                        {student.name}
                      </td>
                      {student.scores.map((score: string, idx: number) => (
                        <td key={idx} className="py-4 px-3 border-l border-gray-100">
                          <input type="number" value={score} onChange={(e) => handleScoreChange(student.id, idx, e.target.value)} className="w-full bg-gray-50/50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl p-4 text-center font-black text-2xl text-indigo-700 outline-none transition-all" placeholder="-" />
                        </td>
                      ))}
                      <td className="py-6 px-8 text-center font-black text-indigo-600 bg-indigo-50/30 text-3xl border-l border-gray-100 italic">{average}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-4 border-indigo-100">
                  <td className="py-8 px-8 font-black text-slate-500 text-sm italic sticky left-0 bg-slate-50 z-10 min-w-[160px] whitespace-nowrap border-r border-indigo-50">CLASS AVG</td>
                  {sessionDates.map((_, i) => (
                    <td key={i} className="py-4 px-3 text-center font-black text-2xl text-indigo-600 border-l border-indigo-100/50">{getColumnAverage(i)}</td>
                  ))}
                  <td className="bg-indigo-100/50"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="p-10 flex flex-col md:flex-row justify-between items-center bg-white border-t border-indigo-50 gap-6">
              <p className="text-indigo-400 font-bold italic text-sm">* 수업 요일에 맞춰 날짜가 자동 생성되었습니다. 한글 입력(예: 보강, 공휴일)도 가능합니다.</p>
              <button onClick={handleSave} className="bg-indigo-600 text-white px-24 py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">저장하기 ✨</button>
          </div>
        </div>
      ) : (
        <div className="text-center py-52 bg-white rounded-[4rem] border-4 border-dashed border-indigo-50 shadow-inner">
           <p className="text-3xl font-black text-indigo-200 italic uppercase">Please Select a Class First</p>
        </div>
      )}
    </div>
  );
}