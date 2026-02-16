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
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getMonth() + 1}월`);
  const [teacherComment, setTeacherComment] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [maxSessions, setMaxSessions] = useState(0); 
  const [masterDates, setMasterDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. 초기 로딩: 학생 목록
  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase.from('students').select('*').order('name', { ascending: true });
      if (data) setStudents(data);
    };
    fetchStudents();
  }, []);

  const classList = ['전체 클래스', ...Array.from(new Set(students.map(s => s.class_name).filter(Boolean)))];

  // 2. 리포트 데이터 가져오기 및 정렬 로직
  const fetchReportData = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const monthNum = selectedMonth.replace('월', '');
      
      // ✅ [설정] 주당 수업 횟수에 따른 최대 회차 제한 (보통 8회)
      // 만약 주 3회 수업 클래스가 있다면 이 값을 12로 유동적으로 조절하거나 
      // 안전하게 8~10 정도로 고정할 수 있습니다.
      const LIMIT_SESSIONS = 8; 

      // 내 성적 데이터
      const { data: grades } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', selectedStudent.id)
        .filter('test_name', 'ilike', `% ${monthNum}월%`)
        .filter('test_date', 'ilike', `${selectedYear}%`);

      // 비교용 전체 성적 데이터
      const { data: allGrades } = await supabase
        .from('grades')
        .select('test_name, score')
        .filter('test_name', 'ilike', `% ${monthNum}월%`)
        .filter('test_date', 'ilike', `${selectedYear}%`);

      const subjects = Array.from(new Set(grades?.map(g => g.test_name.split(']')[0].replace('[', ''))));
      
      const allDatesMap: { [key: number]: string } = {};
      grades?.forEach(g => {
        const sessionMatch = g.test_name.match(/(\d+)회차/);
        if (sessionMatch && g.test_date) {
          const sNum = parseInt(sessionMatch[1]);
          if (sNum <= LIMIT_SESSIONS) { // 제한 범위 내 날짜만 수집
            allDatesMap[sNum] = g.test_date.substring(5).replace('-', '/');
          }
        }
      });

      let tempMax = 0;
      const processedData = subjects.map(sub => {
        const subGrades = grades?.filter(g => g.test_name.startsWith(`[${sub}]`)) || [];
        const sessionDataMap: { [key: number]: any } = {};

        subGrades.forEach(g => {
          const sessionMatch = g.test_name.match(/(\d+)회차/);
          if (sessionMatch) {
            const sNum = parseInt(sessionMatch[1]);
            
            // ✅ [수정] 9회차 등 제한 범위를 벗어나는 데이터는 무시
            if (sNum <= LIMIT_SESSIONS) {
              if (sNum > tempMax) tempMax = sNum;

              const sameTestGrades = allGrades?.filter(ag => ag.test_name === g.test_name) || [];
              const validScores = sameTestGrades.map(sg => Number(sg.score)).filter(s => !isNaN(s));
              const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;

              sessionDataMap[sNum] = {
                session: `${sNum}회차`,
                score: Number(g.score) || 0,
                average: Number(avg.toFixed(1)),
                max: g.max_score || 100
              };
            }
          }
        });

        const sessions = Array.from({ length: tempMax }, (_, i) => {
          const sNum = i + 1;
          return sessionDataMap[sNum] || { session: `${sNum}회차`, score: 0, average: 0, max: 100 };
        });

        const myScores = sessions.map(s => s.score).filter(s => s > 0);
        const myAvg = myScores.length > 0 ? (myScores.reduce((a, b) => a + b, 0) / myScores.length) : 0;
        
        const classAvgs = sessions.map(s => s.average).filter(s => s > 0);
        const classTotalAvg = classAvgs.length > 0 ? (classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length) : 0;

        return { 
          subject: sub, 
          sessions, 
          avgScore: myAvg.toFixed(1), 
          totalClassAvg: classTotalAvg.toFixed(1),
          deviation: (myAvg - classTotalAvg).toFixed(1),
          maxStandard: sessions[0]?.max || 100 
        };
      });

      const masterDatesArray = Array.from({ length: tempMax }, (_, i) => allDatesMap[i + 1] || '-');
      
      setMasterDates(masterDatesArray);
      setMaxSessions(tempMax); 
      setReportData(processedData);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedStudent, selectedYear, selectedMonth]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);

  const handlePrint = () => { window.print(); };

  return (
    <div className="p-6 bg-gray-100 min-h-screen pb-20 font-sans tracking-tight">
      {/* 관리 도구 영역 */}
      <div className="max-w-[1100px] mx-auto bg-white p-8 rounded-[2.5rem] shadow-sm mb-10 print:hidden border border-indigo-50">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black text-indigo-900 tracking-tighter uppercase font-sans">📊 Report Manager</h1>
            <button onClick={handlePrint} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">리포트 발행 (PDF)</button>
        </div>
        <div className="space-y-6">
            <div className="flex flex-wrap md:flex-nowrap gap-4">
                <input type="text" placeholder="학생 성함 검색..." className="w-full md:w-1/2 p-4 border-2 rounded-2xl bg-gray-50 font-bold focus:border-indigo-500 outline-none" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
                <select className="w-full md:w-1/2 p-4 border-2 rounded-2xl font-bold bg-white text-gray-700 focus:border-indigo-500 outline-none" value={classFilter} onChange={(e)=>setClassFilter(e.target.value)}>
                    {classList.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                </select>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-grow h-40 overflow-y-auto border-2 border-gray-100 rounded-2xl p-2 bg-white grid grid-cols-2 md:grid-cols-3 gap-2">
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
                    <textarea className="w-full p-5 border-2 rounded-[2rem] h-28 bg-gray-50 font-bold text-indigo-900 outline-none" placeholder="담당 선생님 피드백..." value={teacherComment} onChange={(e)=>setTeacherComment(e.target.value)} />
                </div>
            </div>
        </div>
      </div>

      {selectedStudent && !loading && (
        <div className="report-container mx-auto">
          {/* [PAGE 01] */}
          <div className="report-page shadow-2xl bg-white mb-10 print:shadow-none print:m-0">
            <div className="flex justify-between items-center mb-8 border-b-2 border-indigo-100 pb-8">
              <div className="flex flex-col justify-center">
                <h2 className="text-[34px] font-black text-gray-900 tracking-tighter leading-none mb-2 uppercase">Student Report <span className="text-indigo-600">{selectedMonth}</span></h2>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[18px]">개별 맞춤 성적 분석 리포트</p>
              </div>
              <div className="flex items-center gap-4 h-14 text-right">
                {/* 1. Montserrat(현대적) 또는 Playfair Display(우아함) 스타일 추천 */}
<div className="flex flex-col justify-center">
  <span className="text-[24px] font-bold text-indigo-900 tracking-tighter leading-none mb-2 ">
    LJY English Institute
  </span>
  <span className="text-xl font-black text-indigo-900 leading-none">
    이주영 영어학원
  </span>
</div>
                <div className="w-1 h-full bg-indigo-600"></div>
              </div>
            </div>
            
            <div className="bg-indigo-50 border-2 border-indigo-100 px-10 py-7 mb-8 rounded-none flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-indigo-900">{selectedStudent.name}</span>
                <span className="text-lg font-bold text-indigo-400">학생</span>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right border-r-2 border-indigo-100 pr-10">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">School / Grade</p>
                  <p className="text-md font-black text-indigo-900">{selectedStudent.school_name} · {selectedStudent.grade_level}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Class Name</p>
                  <p className="text-md font-black text-indigo-600">{selectedStudent.class_name}</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm font-sans shadow-lg">01</span>
                <span className="uppercase text-indigo-900 tracking-tight">월별 성적 요약</span>
              </h3>
              <table className="w-full border-collapse border-t-2 border-indigo-900 table-fixed text-[11px]">
                <thead>
                  <tr className="bg-indigo-50">
                    <th rowSpan={2} className="border-b-2 border-r border-indigo-200 w-[20%] p-2 relative">
                       <div className="flex flex-col justify-between h-[50px]">
                         <span className="self-end text-indigo-900 font-bold">회차(날짜)</span>
                         <span className="self-start text-indigo-900 font-bold">평가항목</span>
                       </div>
                    </th>
                    {[...Array(maxSessions)].map((_, i) => (
                      <th key={i} className="py-2 border-r border-b-2 border-indigo-200 text-[13px] text-center font-black">
                        {i + 1}회
                      </th>
                    ))}
                    <th rowSpan={2} className="py-2 px-2 font-black border-b-2 border-indigo-900 bg-indigo-900 text-[15px] text-white text-center w-[20%]">평균 / 만점</th>
                  </tr>
                  <tr className="bg-white">
                    {[...Array(maxSessions)].map((_, i) => (
                      <th key={i} className="py-1 border-b-2 border-r border-indigo-200 text-center text-[11px] text-gray-500 font-bold">
                        {masterDates[i] || '-'}
                      </th>
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
                        <span className="text-indigo-900 text-[20px]">{data.avgScore}</span>
                        <span className="text-gray-400 mx-1 text-[10px]">/</span>
                        <span className="text-gray-500 text-[14px]">{data.maxStandard}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-4">
                <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm font-sans shadow-lg">02</span>
                  <span className="uppercase text-indigo-900 tracking-tight">반 평균 대비 성적 분석</span>
                </h3>
                <div className="border-2 border-indigo-100 rounded-none overflow-hidden">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/50 text-indigo-400 font-black text-xs uppercase tracking-widest border-b border-indigo-100">
                        <th className="py-4">평가 항목</th>
                        <th className="py-4">내 점수</th>
                        <th className="py-4">반 평균</th>
                        <th className="py-4">편차</th>
                      </tr>
                    </thead>
                    <tbody className="font-bold text-black text-lg">
                      {reportData.map((data, i) => (
                        <tr key={i} className="border-b border-indigo-50 last:border-0">
                          <td className="py-4 text-gray-600">{data.subject}</td>
                          <td className="py-4 text-2xl font-sans">{data.avgScore}점</td>
                          <td className="py-4 text-xl text-gray-400 font-sans">{data.totalClassAvg}점</td>
<td className={`py-4 text-2xl font-sans ${
  Number(data.deviation) > 0 
    ? 'text-rose-500'   // 0 초과: 빨간색
    : Number(data.deviation) < 0 
      ? 'text-blue-600' // 0 미만: 파란색
      : 'text-gray-400' // 0일 때: 회색
}`}>
  {Number(data.deviation) > 0 ? `+${data.deviation}` : data.deviation}
</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
          </div>
          
          {/* [PAGE 02] */}
          <div className="report-page shadow-2xl bg-white print:shadow-none print:m-0 page-break-before">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3">
              <span className="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center text-sm shadow-lg font-sans">03</span>
              <span className="uppercase text-indigo-900 tracking-tight">시험별 성적 추이 분석</span>
            </h3>
            <div className="grid grid-cols-2 gap-6 mb-10">
              {reportData.map((data, i) => (
                <div key={i} className="chart-box bg-white p-6 border border-indigo-50 h-[280px]">
                  <h4 className="font-black text-lg text-indigo-900 border-l-4 border-indigo-600 pl-4 mb-4">{data.subject}</h4>
                  <div className="w-full h-[80%]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sessions} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <YAxis domain={[0, data.maxStandard]} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" iconType="circle" />
                        <Bar dataKey="score" name="내 점수" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="average" name="반 평균" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-auto bg-gray-50 p-12 relative border-t-4 border-indigo-600 min-h-[300px]">
              <h4 className="text-2xl font-black mb-6 flex items-center gap-4 uppercase text-indigo-900">
                <span className="w-2 h-7 bg-indigo-600 rounded-full"></span>담당 선생님 피드백
              </h4>
              <div className="w-full h-[1px] bg-indigo-200 mb-8"></div>
              <p className="text-black leading-[2.2] whitespace-pre-wrap font-bold text-xl">
                {teacherComment || '이번 달 학습 성취도를 종합한 결과, 전반적으로 안정적인 흐름을 보이고 있습니다. 개별 취약 포인트에 대한 집중 관리를 통해 더 높은 성장을 이룰 수 있도록 지도하겠습니다.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .report-container, .report-container * { visibility: visible; }
          .report-container { position: absolute; left: 0; top: 0; width: 210mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .report-page { height: 296mm; padding: 10mm 15mm !important; page-break-after: always; }
          @page { size: A4; margin: 0; }
        }
        .report-container { width: 210mm; }
        .report-page { width: 210mm; min-height: 297mm; padding: 10mm 15mm !important; display: flex; flex-direction: column; background-color: white; }
      `}</style>
    </div>
  );
}