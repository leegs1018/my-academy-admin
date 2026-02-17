'use client';



import { useState, useEffect, useCallback } from 'react';

import { supabase } from '@/lib/supabase';

import {

  BarChart, Bar, XAxis, YAxis, CartesianGrid,

  Tooltip, Legend, ResponsiveContainer

} from 'recharts';



export default function AdminReportPage() {

  const [searchTerm, setSearchTerm] = useState('');

  const [classFilter, setClassFilter] = useState('전체 클래스');

  const [students, setStudents] = useState<any[]>([]);

  const [classListData, setClassListData] = useState<any[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const [selectedYear, setSelectedYear] = useState('2026');

  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getMonth() + 1}월`);

  const [teacherComment, setTeacherComment] = useState('');

  const [reportData, setReportData] = useState<any[]>([]);

  const [maxSessions, setMaxSessions] = useState(0);

  const [masterDates, setMasterDates] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const [isSaving, setIsSaving] = useState(false);



  // 1. 초기 데이터 로드

  useEffect(() => {

    const fetchInitialData = async () => {

      const { data: studentList } = await supabase.from('students').select('*').order('name', { ascending: true });

      const { data: classList } = await supabase.from('classes').select('*');

      if (studentList) setStudents(studentList);

      if (classList) setClassListData(classList);

    };

    fetchInitialData();

  }, []);



  const classNames = ['전체 클래스', ...Array.from(new Set(students.map(s => s.class_name).filter(Boolean)))];



  // 2. 피드백 불러오기

  const fetchFeedback = useCallback(async () => {

    if (!selectedStudent) return;

    const { data } = await supabase.from('teacher_feedbacks').select('content')

      .eq('student_id', selectedStudent.id).eq('year', selectedYear).eq('month', selectedMonth).maybeSingle();

    setTeacherComment(data?.content || '');

  }, [selectedStudent, selectedYear, selectedMonth]);



  // 3. 피드백 저장

  const saveFeedback = async () => {

    if (!selectedStudent) return alert('학생을 먼저 선택해주세요.');

    setIsSaving(true);

    try {

      await supabase.from('teacher_feedbacks').upsert({

        student_id: selectedStudent.id, year: selectedYear, month: selectedMonth, content: teacherComment, updated_at: new Date().toISOString()

      }, { onConflict: 'student_id,year,month' });

      alert('피드백이 저장되었습니다. ✅');

    } catch (err) { alert('저장 중 오류 발생'); } finally { setIsSaving(false); }

  };



  // 4. 성적 데이터 분석

  const fetchReportData = useCallback(async () => {

    if (!selectedStudent) return;

    setLoading(true);

    try {

      const monthNum = selectedMonth.replace('월', '');

      const LIMIT_SESSIONS = 8;

      const currentClassInfo = classListData.find(c => c.class_name === selectedStudent.class_name);

      const categorySettings = Array.isArray(currentClassInfo?.test_categories) ? currentClassInfo.test_categories : [];

      const orderedCategoryNames = categorySettings.map((cat: any) => cat.name);



      const { data: classmates } = await supabase.from('students').select('id').eq('class_name', selectedStudent.class_name);

      const classmateIds = classmates?.map(c => c.id) || [];



      const { data: myGrades } = await supabase.from('grades').select('*').eq('student_id', selectedStudent.id)

        .filter('test_name', 'ilike', `% ${monthNum}월%`).filter('test_date', 'ilike', `${selectedYear}%`);



      const { data: classGrades } = await supabase.from('grades').select('test_name, score').in('student_id', classmateIds)

        .filter('test_name', 'ilike', `% ${monthNum}월%`).filter('test_date', 'ilike', `${selectedYear}%`);



      const rawSubjects = Array.from(new Set(myGrades?.map(g => g.test_name.split(']')[0].replace('[', ''))));

      const subjects = rawSubjects.sort((a, b) => {

        const indexA = orderedCategoryNames.indexOf(a);

        const indexB = orderedCategoryNames.indexOf(b);

        return (indexA === -1 ? 1 : indexA) - (indexB === -1 ? 1 : indexB);

      });

     

      const allDatesMap: { [key: number]: string } = {};

      myGrades?.forEach(g => {

        const sessionMatch = g.test_name.match(/(\d+)회차/);

        if (sessionMatch && g.test_date) {

          const sNum = parseInt(sessionMatch[1]);

          if (sNum <= LIMIT_SESSIONS) allDatesMap[sNum] = g.test_date.substring(5).replace('-', '/');

        }

      });



      let tempMax = 0;

      const processedData = subjects.map(sub => {

        const catSetting = categorySettings.find((c: any) => c.name === sub);

        const description = catSetting?.description || "등록된 학습 설명이 없습니다.";

        const subGrades = myGrades?.filter(g => g.test_name.startsWith(`[${sub}]`)) || [];

        const sessionDataMap: { [key: number]: any } = {};



        subGrades.forEach(g => {

          const sessionMatch = g.test_name.match(/(\d+)회차/);

          if (sessionMatch) {

            const sNum = parseInt(sessionMatch[1]);

            if (sNum <= LIMIT_SESSIONS) {

              if (sNum > tempMax) tempMax = sNum;

              const sameTestClassGrades = classGrades?.filter(cg => cg.test_name.trim() === g.test_name.trim()) || [];

              const validScores = sameTestClassGrades.map(sg => Number(sg.score)).filter(s => s > 0);

              const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;

              sessionDataMap[sNum] = { session: `${sNum}회`, score: Number(g.score) || 0, average: Number(avg.toFixed(1)), max: g.max_score || 100 };

            }

          }

        });



        const sessions = Array.from({ length: tempMax }, (_, i) => sessionDataMap[i + 1] || { session: `${i + 1}회`, score: 0, average: 0, max: 100 });

        const myAvg = sessions.map(s => s.score).filter(s => s > 0).reduce((a, b, _, arr) => a + (b / arr.length), 0) || 0;

        const classTotalAvg = sessions.map(s => s.average).filter(s => s > 0).reduce((a, b, _, arr) => a + (b / arr.length), 0) || 0;



        return { subject: sub, description, sessions, avgScore: myAvg.toFixed(1), totalClassAvg: classTotalAvg.toFixed(1), deviation: (myAvg - classTotalAvg).toFixed(1), maxStandard: sessions[0]?.max || 100 };

      });



      setMasterDates(Array.from({ length: tempMax }, (_, i) => allDatesMap[i + 1] || '-'));

      setMaxSessions(tempMax);

      setReportData(processedData);

    } catch (err) { console.error(err); } finally { setLoading(false); }

  }, [selectedStudent, selectedYear, selectedMonth, classListData]);



  useEffect(() => { fetchReportData(); fetchFeedback(); }, [fetchReportData, fetchFeedback]);



  return (

    <div className="p-6 bg-gray-100 min-h-screen pb-20 font-sans tracking-tight">

      {/* 관리 도구 (인쇄 제외) */}

      <div className="max-w-[1100px] mx-auto bg-white p-8 rounded-[2.5rem] shadow-sm mb-10 print:hidden border border-indigo-50">

        <div className="flex justify-between items-center mb-8">

            <h1 className="text-3xl font-black text-indigo-900 tracking-tighter uppercase">📊 Report Manager</h1>

            <button onClick={() => window.print()} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">리포트 발행 (PDF)</button>

        </div>

        <div className="space-y-6">

            <div className="flex flex-wrap md:flex-nowrap gap-4">

                <input type="text" placeholder="학생 성함 검색..." className="w-full md:w-1/2 p-4 border-2 rounded-2xl bg-gray-50 font-bold focus:border-indigo-500 outline-none" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />

                <select className="w-full md:w-1/2 p-4 border-2 rounded-2xl font-bold bg-white text-gray-700 focus:border-indigo-500 outline-none" value={classFilter} onChange={(e)=>setClassFilter(e.target.value)}>

                    {classNames.map(cls => <option key={cls} value={cls}>{cls}</option>)}

                </select>

            </div>

            <div className="flex flex-col md:flex-row gap-6">

                <div className="flex-grow h-44 overflow-y-auto border-2 border-gray-100 rounded-2xl p-2 bg-white grid grid-cols-2 md:grid-cols-3 gap-2">

                    {students.filter(s => s.name.includes(searchTerm) && (classFilter === '전체 클래스' || s.class_name === classFilter)).map(s=>(

                        <div key={s.id} onClick={()=>setSelectedStudent(s)} className={`p-3 rounded-xl cursor-pointer font-bold text-center transition-all border ${selectedStudent?.id === s.id ? 'bg-indigo-600 text-white shadow-md':'bg-white text-gray-600 border-gray-100 hover:bg-indigo-50'}`}>

                            {s.name} <span className="block text-[10px] opacity-60">{s.class_name}</span>

                        </div>

                    ))}

                </div>

                <div className="w-full md:w-80 space-y-4">

                    <div className="grid grid-cols-2 gap-4">

                        <select className="p-4 border-2 rounded-2xl font-bold bg-gray-50 text-indigo-900" value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)}>

                            <option value="2025">2025년</option><option value="2026">2026년</option>

                        </select>

                        <select className="p-4 border-2 rounded-2xl font-bold bg-gray-50 text-indigo-900" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}>

                            {[...Array(12)].map((_,i)=><option key={i+1} value={`${i+1}월`}>{i+1}월</option>)}

                        </select>

                    </div>

                    <textarea className="w-full p-5 border-2 rounded-[2rem] h-28 bg-gray-50 font-bold text-indigo-900 outline-none focus:border-indigo-500" placeholder="피드백 입력..." value={teacherComment} onChange={(e)=>setTeacherComment(e.target.value)} />

                    <button onClick={saveFeedback} disabled={isSaving} className={`w-full py-3 rounded-xl font-black text-white transition-all ${isSaving ? 'bg-gray-400' : 'bg-indigo-500 hover:bg-indigo-600 shadow-lg'}`}>

                        {isSaving ? '저장 중...' : '피드백 저장하기'}

                    </button>

                </div>

            </div>

        </div>

      </div>



      {selectedStudent && !loading && (

        <div className="report-container mx-auto">

         

          {/* PAGE 01: 로고 디자인 반영 헤더 */}

          <div className="report-page shadow-2xl bg-white print:shadow-none">

            <div className="flex justify-between items-start mb-6 border-b-2 border-indigo-100 pb-6">

              <div>

                <h2 className="text-[32px] font-black text-gray-900 leading-none mb-2 uppercase tracking-tighter">

                  Student Report <span className="text-indigo-600">{selectedMonth}</span>

                </h2>

                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[14px]">개별 맞춤 성적 분석 리포트</p>

              </div>

              <div className="flex items-center gap-4">

                <div className="text-right">

                  <p className="text-[18px] font-black text-indigo-900 leading-none mb-1 tracking-tight">LJY English Institute</p>

                  <p className="text-[22px] font-black text-indigo-900 leading-none">이주영 영어학원</p>

                </div>

                <div className="w-[3px] h-12 bg-indigo-600"></div>

              </div>

            </div>



            {/* PAGE 01: 학생 정보 카드 */}

            <div className="bg-indigo-50 border-2 border-indigo-100 px-8 py-5 mb-6 flex items-center">

              <div className="flex-1">

                <span className="text-3xl font-black text-indigo-900">

                  {selectedStudent.name} <span className="text-lg font-bold text-indigo-400 ml-1">학생</span>

                </span>

              </div>

              <div className="flex-1 text-center border-x-2 border-indigo-100 px-4">

                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">School & Grade</p>

                <p className="text-[17px] font-bold text-gray-700">

                  {selectedStudent.school_name} <span className="text-indigo-400 mx-2">|</span> {selectedStudent.grade_level}

                </p>

              </div>

              <div className="flex-1 text-right">

                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">Class Name</p>

                <p className="text-[17px] font-black text-indigo-600">{selectedStudent.class_name}</p>

              </div>

            </div>



            <div className="mb-8">

            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              {/* shadow-lg를 지우고 border를 추가합니다 */}
               <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm font-sans border border-indigo-700">01</span>
              <span className="uppercase text-indigo-900 tracking-tight font-sans text-[26px]">월별 성적 요약</span>
            </h3>

              <table className="w-full border-collapse border-t-2 border-indigo-900 table-fixed text-[11px] mb-6">

  <thead>

                  <tr className="bg-indigo-50">

                    <th rowSpan={2} className="border-b-2 border-r border-indigo-200 w-[20%] p-0 relative overflow-hidden bg-indigo-50/50">

                      <div className="absolute inset-0" style={{background: 'linear-gradient(to top right, transparent calc(50% - 0.5px), #c7d2fe 50%, transparent calc(50% + 0.5px))'}}></div>

                      <div className="relative h-[60px] w-full">

                        <span className="absolute top-2 right-2 text-indigo-900 font-bold text-[10px]">회차 (날짜)</span>

                        <span className="absolute bottom-2 left-2 text-indigo-900 font-bold text-[10px]">평가 항목</span>

                      </div>

                    </th>

                    {[...Array(maxSessions)].map((_, i) => (

                      <th key={i} className="py-2 border-r border-b-2 border-indigo-200 text-[13px] text-center font-black">{i + 1}회</th>

                    ))}

                    <th rowSpan={2} className="py-2 px-2 font-black border-b-2 border-indigo-900 bg-indigo-900 text-[15px] text-white text-center w-[20%]">평균 / 만점</th>

                  </tr>

                  <tr className="bg-white">

                    {[...Array(maxSessions)].map((_, i) => (

                      <th key={i} className="py-1 border-b-2 border-r border-indigo-200 text-center text-[11px] text-gray-500 font-bold">{masterDates[i] || '-'}</th>

                    ))}

                  </tr>

                </thead>

                <tbody>

                  {reportData.map((data, i) => (

                    <tr key={i} className="border-b border-indigo-100">

                      <td className="py-3 px-2 text-center font-black bg-indigo-50/30 text-[13px] border-r border-indigo-100">{data.subject}</td>

                      {[...Array(maxSessions)].map((_, idx) => (

                        <td key={idx} className="py-3 border-r border-indigo-100 text-center font-black text-[16px]">

                          {data.sessions[idx]?.score > 0 ? data.sessions[idx].score : <span className="text-gray-200">-</span>}

                        </td>

                      ))}

                      <td className="py-3 bg-indigo-50/40 text-center font-black">

                        <span className="text-indigo-900 text-[20px] font-sans">{data.avgScore}</span>

                        <span className="text-gray-400 mx-1 text-[10px]">/</span>

                        <span className="text-gray-500 text-[14px] font-sans">{data.maxStandard}</span>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>



              <div className="bg-slate-50 border-y border-slate-200 py-5 px-8 space-y-3">

                <h4 className="text-[20px] font-black text-indigo-900 uppercase tracking-[0.2em] mb-2">평가항목 설명</h4>

                {reportData.map((data, idx) => (

                  <div key={idx} className="flex gap-4 items-start border-b border-slate-100 last:border-0 pb-2 last:pb-0">

                    <div className="min-w-[100px] bg-indigo-100 text-indigo-700 px-3 py-2 text-[14px] font-black text-center">{data.subject}</div>

                    <p className="text-[14px] py-2 font-bold text-slate-600 leading-relaxed">{data.description}</p>

                  </div>

                ))}

              </div>

            </div>

          </div>



          {/* PAGE 02: 반 평균 대비 분석 */}

          <div className="report-page shadow-2xl bg-white print:shadow-none">

            <h3 className="text-xl font-black mb-8 flex items-center gap-3">

              <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm font-sans shadow-lg">02</span>

              <span className="uppercase text-indigo-900 tracking-tight font-sans text-[26px]">반 평균 대비 성적 분석</span>

            </h3>



  
{/* 2페이지 카드 그리드: 4컬럼 구성 (소수점 반영 버전) */}
<div className="grid grid-cols-4 gap-4 mb-10">
  {(() => {
    // 1. 기본 데이터 계산 로직
    const subjectCount = reportData.length || 1;
    
    // 나의 전체 평균 (모든 과목 avgScore의 평균)
    const totalMyAvg = reportData.reduce((acc, curr) => acc + Number(curr.avgScore), 0) / subjectCount;
    
    // 클래스 전체 평균 (모든 과목 totalClassAvg의 평균)
    const totalClassAvg = reportData.reduce((acc, curr) => acc + Number(curr.totalClassAvg), 0) / subjectCount;
    
    // 종합 만점 기준 (모든 과목 maxStandard의 평균) - 소수점 반영
    const averageMaxScore = reportData.reduce((acc, curr) => acc + Number(curr.maxStandard), 0) / subjectCount;
    
    // 편차 계산
    const deviation = (totalMyAvg - totalClassAvg).toFixed(1);

    return (
      <>
      {/* 1. 종합 만점 기준 (소수점 반영) */}
        <div className="bg-slate-50 rounded-[2rem] p-6 flex flex-col items-center justify-center border-2 border-slate-200 shadow-none">
          <p className="text-slate-500 font-black text-[13px] mb-3 uppercase tracking-widest">클래스 만점 기준</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[36px] font-black text-slate-700 leading-none">{averageMaxScore.toFixed(1)}</span>
            <span className="text-sm font-bold text-slate-700">점</span>
          </div>
        </div>
        {/* 2. 나의 종합 평균 */}
        <div className="bg-[#f0f4ff] rounded-[2rem] p-6 flex flex-col items-center justify-center border-2 border-indigo-100 shadow-none">
          <p className="text-indigo-600 font-black text-[13px] mb-3 uppercase tracking-widest">나의 평균</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[36px] font-black text-indigo-900 leading-none">{totalMyAvg.toFixed(1)}</span>
            <span className="text-sm font-bold text-indigo-900">점</span>
          </div>
        </div>

        {/* 3. 클래스 평균 */}
        <div className="bg-[#f8f9fa] rounded-[2rem] p-6 flex flex-col items-center justify-center border-2 border-gray-200 shadow-none">
          <p className="text-gray-500 font-black text-[13px] mb-3 uppercase tracking-widest">클래스 평균</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[36px] font-black text-gray-700 leading-none">{totalClassAvg.toFixed(1)}</span>
            <span className="text-sm font-bold text-gray-700">점</span>
          </div>
        </div>

        

        {/* 4. 평균 대비 */}
        <div className="bg-[#eefcf4] rounded-[2rem] p-6 flex flex-col items-center justify-center border-2 border-emerald-200 shadow-none">
          <p className="text-emerald-600 font-black text-[13px] mb-3 uppercase tracking-widest">평균 대비</p>
          <div className="flex items-baseline gap-1">
            <span className="text-[36px] font-black text-emerald-700 leading-none">
              {Number(deviation) > 0 ? `+${deviation}` : deviation}
            </span>
            <span className="text-sm font-bold text-emerald-700">점</span>
          </div>
        </div>
      </>
    );
  })()}
</div>
  


            {/* 하단 분석 테이블 - 직각형 */}

            <div className="border-t-2 border-b-2 border-indigo-900 overflow-hidden">

              <table className="w-full text-center border-collapse">

                <thead>

                  <tr className="bg-indigo-50/50 text-indigo-900 font-black text-xs uppercase tracking-widest border-b border-indigo-100">

                    <th className="py-5 border-r border-indigo-50 text-[20px]">평가 항목</th>

                    <th className="py-5 border-r border-indigo-50 text-[20px]">내 평균</th>

                    <th className="py-5 border-r border-indigo-50 text-[20px]">반 평균</th>

                    <th className="py-5 text-[20px]">편차</th>

                  </tr>

                </thead>

                <tbody className="font-bold text-black text-lg">

                  {reportData.map((data, i) => (

                    <tr key={i} className="border-b border-indigo-50 last:border-0 hover:bg-gray-50">

                      <td className="py-5 text-gray-600 font-black border-r border-indigo-50 bg-gray-50/30">{data.subject}</td>

                      <td className="py-5 text-3xl font-black border-r border-indigo-50 text-[24px]">{data.avgScore}점</td>

                      <td className="py-5 text-xl text-gray-400 border-r border-indigo-50">{data.totalClassAvg}점</td>

                      <td className={`py-5 text-3xl font-black text-[24px] ${Number(data.deviation) > 0 ? 'text-rose-500' : 'text-blue-600'}`}>

                        {Number(data.deviation) > 0 ? `+${data.deviation}` : data.deviation}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

{/* PAGE 03: 시험별 성적 추이 분석 */}
<div className="report-page shadow-2xl bg-white print:shadow-none">
  <h3 className="text-xl font-black mb-6 flex items-center gap-3">
    <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm shadow-lg font-sans">03</span>
    <span className="uppercase text-indigo-900 tracking-tight font-sans text-[26px]">시험별 성적 추이 분석</span>
  </h3>

 <div className="grid grid-cols-2 gap-x-6 gap-y-4">
  {reportData.map((data, i) => (
    <div key={i} className="bg-white p-5 border border-gray-200 h-[300px] flex flex-col shadow-none overflow-hidden">
      {/* 1. 제목 */}
      <h4 className="font-black text-base text-indigo-900 border-l-4 border-indigo-600 pl-3 mb-2">
        {data.subject}
      </h4>
      
      {/* 2. 그래프 영역 (flex-grow를 주어 공간을 먼저 차지하게 함) */}
      <div className="flex-grow w-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.sessions}
            margin={{ top: 5, right: 5, left: -35, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="session"
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
            />
            <YAxis
              domain={[0, data.maxStandard]}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 10, fill: '#cbd5e1'}}
            />
            <Tooltip cursor={false} contentStyle={{ display: 'none' }} />
            <Bar dataKey="score" fill="#4f46e5" barSize={18} />
            <Bar dataKey="average" fill="#8f97a0" barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3. 범례 영역 (그래프 아래로 이동 및 중앙 정렬) */}
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-[10px] h-[10px] bg-[#4f46e5]"></div>
          <span className="text-[11px] font-bold text-slate-600">내 점수</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-[10px] h-[10px] bg-[#8f97a0]"></div>
          <span className="text-[11px] font-bold text-slate-600">반 평균</span>
        </div>
      </div>
    </div>
  ))}
</div>
</div>



          {/* PAGE 04: 종합 의견 - 배경색 수정됨 (bg-slate-50) */}

          <div className="report-page shadow-2xl bg-white print:shadow-none flex flex-col">

            <h3 className="text-xl font-black mb-10 flex items-center gap-3">

              <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm shadow-lg font-sans">04</span>

              <span className="uppercase text-indigo-900 tracking-tight font-sans text-[26px]">종합 의견</span>

            </h3>

           

            <div className="flex-grow bg-slate-50 p-12 text-gray-800 shadow-inner relative overflow-hidden border-l-[12px] border-indigo-600">

              <div className="absolute top-0 right-0 p-10 opacity-10 font-black text-[120px] text-indigo-900 leading-none">“</div>

              <h4 className="text-2xl font-black mb-8 text-indigo-900 flex items-center gap-4">이번 달 담당 선생님 의견</h4>

              <div className="w-full h-[2px] bg-indigo-100 mb-8"></div>

              <p className="text-gray-700 leading-[2.2] whitespace-pre-wrap font-bold text-[21px] relative z-10">

                {teacherComment || '이번 달 학습 성취도를 종합한 결과, 전반적으로 안정적인 흐름을 보이고 있습니다.'}

              </p>

              <div className="absolute bottom-0 left-0 p-10 opacity-10 font-black text-[120px] text-indigo-900 leading-none w-full text-right">”</div>

            </div>



            <footer className="mt-16 border-t-2 border-indigo-50 pt-8 flex justify-between items-end">

              <div className="flex items-center gap-4">

                <div className="text-left">

                  <p className="text-lg font-black text-indigo-900 leading-none mb-1 tracking-tight">LJY English Institute</p>

                  <p className="text-2xl font-black text-indigo-900 leading-none">이주영 영어학원</p>

                </div>

                <div className="w-[3px] h-10 bg-indigo-600"></div>

              </div>

              <div className="text-right text-gray-300 font-bold text-sm uppercase font-sans">

                {selectedYear}. {selectedMonth} Performance Report

              </div>

            </footer>

          </div>

        </div>

      )}



<style jsx global>{`
  @media print {
    /* 1. 기본 인쇄 설정 */
    html, body { 
      margin: 0; padding: 0; 
      background: white !important; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    
    body * { visibility: hidden; }
    .report-container, .report-container * { visibility: visible; }
    .report-container { position: absolute; left: 0; top: 0; width: 210mm; margin: 0 !important; }
    
    .report-page {
      width: 210mm;
      height: 297mm;
      padding: 15mm 15mm !important;
      margin: 0 !important;
      page-break-after: always !important;
      box-sizing: border-box;
      background: white !important;
      display: flex;
      flex-direction: column;
    }

    .report-page:last-child { page-break-after: auto !important; }
    @page { size: A4; margin: 0; }

    /* ✅ 2. 문제의 회색 박스(Tooltip Cursor) 및 유령 사각형 제거 */
    .recharts-tooltip-cursor,
    .recharts-legend-wrapper,
    .recharts-default-legend,
    svg defs {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }

    /* ✅ 3. SVG 내부 필터 오류 방지 */
    svg {
      filter: none !important;

      /* 그림자가 모바일에서 번짐의 주원인이므로 인쇄 시 모두 제거 */
  * {
      box-shadow: none !important;
      text-shadow: none !important;
      -webkit-filter: none !important;
      filter: none !important;
    }
      /* 레이어 겹침으로 인한 잔상 방지 */
    .report-page {
      position: relative;
      overflow: hidden;
      background: white !important;
    }
      /* 모바일 PDF 뷰어에서 박스 테두리 왜곡 방지 */
  .report-page * {
    -webkit-print-color-adjust: exact;
  }

  /* 테두리가 너무 얇으면 뭉개지므로 최소 두께 보장 */
  .border, .border-2 {
    border-width: 1.5pt !important;
    border-style: solid !important;
  }

  /* 리포트 페이지 간격 강제 고정 */
  .report-page {
    page-break-inside: avoid;
    break-inside: avoid;
  }
    }
  }

  /* 화면 표시용 설정 */
  .report-container { width: 210mm; margin: 0 auto; }
  .report-page {
    width: 210mm;
    height: 297mm;
    padding: 15mm 15mm !important;
    margin-bottom: 50px;
    background: white;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  /* 그래프 넘침 방지 */
  .recharts-wrapper {
    overflow: hidden !important;
  }
`}</style>

    </div>

  );

}