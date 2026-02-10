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

  const [cumulativeStart, setCumulativeStart] = useState(1);

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

    if (!selectedClassId || classList.length === 0) return;

    const currentClass = classList.find(c => c.id.toString() === selectedClassId);

    if (currentClass) {

      const cats = currentClass.test_categories?.length > 0

                   ? currentClass.test_categories

                   : ['단어', '듣기', '본시험'];

      setDynamicCategories(cats);

      setSelectedCategory(cats[0]);

      const monthDiff = Math.max(0, selectedMonth - (currentClass.start_month || 1));

      const startRound = (monthDiff * 8) + 1;

      setCumulativeStart(startRound);

    }

  }, [selectedClassId, selectedMonth, classList]);



  useEffect(() => {

    if (selectedClassId && selectedCategory) {

      fetchData(selectedClassId, selectedMonth, cumulativeStart, selectedCategory);

    }

  }, [selectedClassId, selectedMonth, selectedCategory, cumulativeStart]);



  const fetchData = async (classId: string, month: number, startRound: number, category: string) => {

    setLoading(true);

    const currentClassObj = classList.find(c => c.id.toString() === classId);

    const targetClassName = currentClassObj?.class_name;

    if (!targetClassName) { setLoading(false); return; }



    const { data: studentData } = await supabase.from('students').select('*').eq('class_name', targetClassName);

    const { data: gradeData } = await supabase.from('grades').select('*').filter('test_name', 'ilike', `[${category}] ${month}월%`);



    // ★ [추가] DB에 저장된 성적이 있다면, 그 중 첫 번째 데이터의 max_score를 가져와 세팅합니다.

    if (gradeData && gradeData.length > 0) {

      const savedMaxScore = gradeData[0].max_score;

      if (savedMaxScore) setMaxScore(savedMaxScore);

    } else {

      // 해당 월/과목에 데이터가 아예 없는 경우 기본값 100으로 세팅 (필요시 변경 가능)

      setMaxScore(100);

    }



    if (studentData) {

      const formatted = studentData.map(student => {

        const scores = Array(8).fill('');

        for (let i = 0; i < 8; i++) {

          const testName = `[${category}] ${month}월 ${startRound + i}회차`;

          const found = gradeData?.find(g => g.student_id === student.id && g.test_name === testName);

          if (found) scores[i] = found.score.toString();

        }

        return { ...student, scores };

      });

      setStudents(formatted);

    }

    setLoading(false);

  };



  const handleScoreChange = (studentId: string, idx: number, value: string) => {

    if (value !== '' && (Number(value) < 0 || Number(value) > maxScore)) return;

   setStudents(prev => prev.map(s => s.id === studentId ? { ...s, scores: s.scores.map((v: any, i: number) => i === idx ? value : v) } : s));

  };



  const getColumnAverage = (colIdx: number) => {

    const validScores = students.map(s => s.scores[colIdx]).filter(score => score !== '').map(Number);

    if (validScores.length === 0) return '-';

    return (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1);

  };



  const handleSave = async () => {

    if (!confirm(`${selectedMonth}월 [${selectedCategory}] 성적을 저장하시겠습니까?`)) return;

    setLoading(true);

    const upsertData: any[] = [];

    students.forEach(student => {

      student.scores.forEach((score: string, idx: number) => {

        if (score !== '') {

          upsertData.push({

            student_id: student.id,

            test_name: `[${selectedCategory}] ${selectedMonth}월 ${cumulativeStart + idx}회차`,

            score: parseInt(score),

            test_date: new Date().toISOString().split('T')[0],

            max_score: maxScore,

          });

        }

      });

    });

    const { error } = await supabase.from('grades').upsert(upsertData, { onConflict: 'student_id, test_name' });

    if (error) alert('저장 실패: ' + error.message);

    else alert(`저장되었습니다! ✅`);

    setLoading(false);

  };



  return (

    <div className="max-w-[98%] mx-auto py-10 px-4">

      <div className="flex flex-wrap items-end mb-8 bg-white p-8 rounded-[2.5rem] shadow-sm border border-indigo-50 gap-8">

        <div className="flex-1 min-w-[200px]">

          <h1 className="text-3xl font-black text-indigo-900 mb-1 tracking-tight italic">성적 입력 매니저</h1>

          <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest">Performance Tracking System</p>

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



      {selectedClassId ? (

        <div className="bg-white rounded-[3rem] shadow-2xl border border-indigo-50 overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full border-collapse">

              <thead>

                <tr className="bg-slate-800 text-slate-400">

                  <th className="py-3 px-8 text-left text-[15px] font-black tracking-[0.2em]"></th>

                  <th colSpan={8} className="py-3 text-center text-[25px] font-black border-l border-slate-700 tracking-[0.5em] text-indigo-300">차수</th>

                  <th className="py-3 px-8 text-[10px] font-black border-l border-slate-700"></th>

                </tr>

                <tr className="bg-indigo-600 text-white">

                  <th className="py-8 px-8 text-left font-black sticky left-0 bg-indigo-600 z-10 text-xl border-b-4 border-indigo-700">이름</th>

                  {[...Array(8)].map((_, i) => (

                    <th key={i} className="py-6 px-2 text-center border-l border-indigo-500/50 border-b-4 border-indigo-700 min-w-[110px]">

                      <div className="text-3xl font-black mb-1 leading-none">{i+1}회</div>

                      <div className="text-[10px] font-bold text-indigo-200">누적 {cumulativeStart + i}회차</div>

                    </th>

                  ))}

                  <th className="py-8 px-8 font-black text-center border-l border-indigo-500/50 bg-indigo-700 border-b-4 border-indigo-800 text-xl">개인 평균</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-100">

                {students.map((student) => {

                  const validScores = student.scores.filter((s: any) => s !== '').map(Number);

                  const average = validScores.length > 0 ? (validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length).toFixed(1) : '-';

                  return (

                    <tr key={student.id} className="hover:bg-indigo-50/20 group transition-colors">

                      <td className="py-6 px-8 font-black text-indigo-900 sticky left-0 bg-white border-r border-gray-50 text-lg group-hover:bg-indigo-50 transition-all">{student.name}</td>

                      {student.scores.map((score: string, idx: number) => (

                        <td key={idx} className="py-4 px-3 border-l border-gray-50">

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

                  <td className="py-8 px-8 font-black text-slate-500 text-sm italic uppercase">Class Average</td>

                  {[...Array(8)].map((_, i) => (

                    <td key={i} className="py-4 px-3 text-center font-black text-2xl text-indigo-600 border-l border-indigo-100/50">{getColumnAverage(i)}</td>

                  ))}

                  <td className="bg-indigo-100/50 py-8 px-8 text-center font-black text-3xl text-indigo-800 border-l border-indigo-200 italic">{students.flatMap(s => s.scores).filter(v => v !== '').length > 0 ? (students.flatMap(s => s.scores).filter(v => v !== '').reduce((a, b) => a + Number(b), 0) / students.flatMap(s => s.scores).filter(v => v !== '').length).toFixed(1) : '-'}</td>

                </tr>

              </tfoot>

            </table>

          </div>

          <div className="p-10 flex flex-col md:flex-row justify-between items-center bg-white border-t border-indigo-50 gap-6">

            <div className="space-y-1">

              <p className="text-indigo-900 font-black text-xl tracking-tight">[{selectedCategory}] {selectedMonth}월 데이터를 입력 중입니다.</p>

              <p className="text-indigo-300 font-bold text-xs">만점({maxScore}점)을 초과할 수 없습니다.</p>

            </div>

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