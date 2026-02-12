'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function AdminReportPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getMonth() + 1}월`);
  const [teacherComment, setTeacherComment] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [maxSessions, setMaxSessions] = useState(0); 
  const [loading, setLoading] = useState(false);

  // 초기 학생 목록 불러오기
  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase.from('students').select('*').order('name', { ascending: true });
      if (data) setStudents(data);
    };
    fetchStudents();
  }, []);

  // 리포트 데이터를 가져오는 로직 (학생, 연도, 월 변경 시 호출)
  const fetchReportData = useCallback(async () => {
    if (!selectedStudent) return;

    setLoading(true);
    try {
      const monthNum = selectedMonth.replace('월', '');
      
      // 1. 해당 학생의 성적 가져오기
      const { data: grades } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', selectedStudent.id)
        .filter('test_name', 'ilike', `% ${monthNum}월%`)
        .filter('test_date', 'ilike', `${selectedYear}%`);

      // 2. 비교를 위한 전체 학생 성적 가져오기 (반 평균 계산용)
      const { data: allGrades } = await supabase
        .from('grades')
        .select('test_name, score')
        .filter('test_name', 'ilike', `% ${monthNum}월%`)
        .filter('test_date', 'ilike', `${selectedYear}%`);

      const subjects = Array.from(new Set(grades?.map(g => g.test_name.split(']')[0].replace('[', ''))));
      
      let tempMax = 0;
      const processedData = subjects.map(sub => {
        const subGrades = grades?.filter(g => g.test_name.startsWith(`[${sub}]`)) || [];
        if (subGrades.length > tempMax) tempMax = subGrades.length;

        const sessions = subGrades.map((g, idx) => {
          const testName = g.test_name;
          const sameTestGrades = allGrades?.filter(ag => ag.test_name === testName) || [];
          
          const validScores = sameTestGrades.map(sg => Number(sg.score)).filter(s => !isNaN(s));
          const avg = validScores.length > 0 
            ? (validScores.reduce((a, b) => a + b, 0) / validScores.length)
            : 0;

          return { 
            session: `${idx + 1}회`, 
            score: Number(g.score) || 0, 
            average: Number(avg.toFixed(1)), 
            max: g.max_score || 100 
          };
        });

        const myTotal = sessions.reduce((a, b) => a + b.score, 0);
        const myAvg = sessions.length > 0 ? (myTotal / sessions.length) : 0;
        const classTotalAvg = sessions.length > 0 
          ? (sessions.reduce((a, b) => a + b.average, 0) / sessions.length)
          : 0;

        const deviation = myAvg - classTotalAvg;

        return { 
          subject: sub, 
          sessions, 
          avgScore: myAvg.toFixed(1), 
          totalClassAvg: classTotalAvg.toFixed(1),
          deviation: deviation.toFixed(1),
          maxStandard: sessions[0]?.max || 100 
        };
      });

      setMaxSessions(tempMax); 
      setReportData(processedData);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }, [selectedStudent, selectedYear, selectedMonth]);

  // 학생, 연도, 월이 바뀔 때마다 데이터를 자동으로 다시 불러옴
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handlePrint = () => { window.print(); };

  return (
    <div className="p-6 bg-gray-100 min-h-screen pb-20 font-sans tracking-tight">
      <div className="max-w-[1100px] mx-auto bg-white p-8 rounded-[2.5rem] shadow-sm mb-10 print:hidden border border-indigo-50">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-black text-indigo-900 italic tracking-tighter">📊 REPORT MANAGER</h1>
            <button onClick={handlePrint} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl">리포트 발행 (PDF)</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
                <input type="text" placeholder="이름 검색..." className="w-full p-4 border-2 rounded-2xl bg-gray-50 font-bold" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
                <div className="h-44 overflow-y-auto border-2 border-gray-50 rounded-2xl p-2 bg-white">
                    {students.filter(s=>s.name.includes(searchTerm)).map(s=>(
                        <div key={s.id} onClick={()=>setSelectedStudent(s)} className={`p-3 rounded-xl cursor-pointer font-bold mb-1 ${selectedStudent?.id === s.id ? 'bg-indigo-600 text-white shadow-md':'hover:bg-indigo-50 text-gray-600'}`}>
                            {s.name} <span className="text-[10px] opacity-60 ml-1">{s.school_name}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="md:col-span-3 space-y-4">
                <div className="flex gap-4">
                    <select className="flex-1 p-4 border-2 rounded-2xl font-bold bg-gray-50 text-indigo-900" value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)}>
                        <option value="2025">2025년</option><option value="2026">2026년</option>
                    </select>
                    <select className="flex-1 p-4 border-2 rounded-2xl font-bold bg-gray-50 text-indigo-900" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}>
                        {[...Array(12)].map((_,i)=><option key={i+1} value={`${i+1}월`}>{i+1}월</option>)}
                    </select>
                </div>
                <textarea className="w-full p-5 border-2 rounded-[2rem] h-28 bg-gray-50 font-bold text-indigo-900" placeholder="피드백 입력..." value={teacherComment} onChange={(e)=>setTeacherComment(e.target.value)} />
            </div>
        </div>
      </div>

      {selectedStudent && !loading && (
        <div className="report-container mx-auto">
          {/* [PAGE 01] */}
          <div className="report-page shadow-2xl bg-white mb-10 print:shadow-none print:m-0">
            <div className="mb-10">
              <div className="flex justify-between items-end mb-8 border-b-2 border-indigo-100 pb-6">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tighter">
                    STUDENT REPORT <span className="text-indigo-600">{selectedMonth}</span>
                  </h2>
                  <p className="text-gray-500 font-bold mt-1">개별 맞춤 성적 분석 리포트</p>
                </div>
                <div className="h-16 w-auto">
                  <img src="/academy-logo.png" alt="LOGO" className="h-full object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                </div>
              </div>
              
              <div className="bg-indigo-50 border-2 border-indigo-100 px-10 py-7 rounded-[2.5rem] flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-indigo-900">{selectedStudent.name}</span>
                  <span className="text-lg font-bold text-indigo-400">학생</span>
                </div>
                <div className="flex items-center gap-10">
                  <div className="text-right border-r-2 border-indigo-100 pr-10">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">School / Grade</p>
                    <p className="text-md font-black text-indigo-900">{selectedStudent.school_name} <span className="text-indigo-400 mx-1">·</span> {selectedStudent.grade_level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Class Name</p>
                    <p className="text-md font-black text-indigo-600">{selectedStudent.class_name || '수강 클래스'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 01. 성적 요약 */}
            <div className="mb-10">
              <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-sm font-sans shadow-lg">01</span>
                <span className="italic uppercase text-indigo-900 tracking-tight">Monthly Score Summary</span>
              </h3>
              <div className="rounded-[2.5rem] overflow-hidden border-2 border-indigo-50 shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-indigo-600 text-white text-[13px]">
                      <th className="p-5 text-left font-black border-r border-indigo-500/30">평가 항목</th>
                      {[...Array(maxSessions)].map((_, i) => (
                        <th key={i} className="p-2 font-black border-r border-indigo-500/30 text-center">{i+1}회</th>
                      ))}
                      <th className="p-5 font-black bg-indigo-800 text-white italic text-center min-w-[140px]">평균 / 만점</th>
                    </tr>
                  </thead>
                  <tbody className="text-center font-bold text-indigo-900">
                    {reportData.length > 0 ? reportData.map((data, i) => (
                      <tr key={i} className="border-b border-indigo-50">
                        <td className="p-5 text-left bg-indigo-50/20 font-black border-r border-indigo-50">{data.subject}</td>
                        {[...Array(maxSessions)].map((_, idx) => (
                          <td key={idx} className="p-2 text-lg border-r border-indigo-50 font-sans">
                            {data.sessions[idx]?.score ?? <span className="text-gray-200">-</span>}
                          </td>
                        ))}
                        <td className="p-5 bg-indigo-50/40 font-black">
                          <span className="text-indigo-600 text-2xl font-sans">{data.avgScore}</span>
                          <span className="text-indigo-200 mx-1 font-light">/</span>
                          <span className="text-indigo-300 text-sm font-sans">{data.maxStandard}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={maxSessions + 2} className="p-10 text-gray-400">데이터가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 02. 분석 테이블 */}
            <div className="mb-6">
               <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-sm font-sans shadow-lg">02</span>
                  <span className="italic uppercase text-indigo-900 tracking-tight">Average & Deviation Analysis</span>
               </h3>
               <div className="bg-white rounded-[2.5rem] overflow-hidden border-2 border-indigo-100 shadow-sm">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/50 text-indigo-400 font-black text-xs uppercase tracking-widest border-b border-indigo-100 font-sans">
                        <th className="py-4">평가 과목</th>
                        <th className="py-4">내 점수</th>
                        <th className="py-4">반 평균</th>
                        <th className="py-4">편차</th>
                      </tr>
                    </thead>
                    <tbody className="font-bold text-indigo-900">
                      {reportData.map((data, i) => (
                        <tr key={i} className="border-b border-indigo-50 last:border-0">
                          <td className="py-5 text-indigo-400">{data.subject}</td>
                          <td className="py-5 text-2xl text-indigo-600 font-sans">{data.avgScore}<span className="text-sm ml-0.5">점</span></td>
                          <td className="py-5 text-xl text-gray-400 font-sans">{data.totalClassAvg}<span className="text-sm ml-0.5">점</span></td>
                          <td className={`py-5 text-2xl font-sans ${Number(data.deviation) >= 0 ? 'text-indigo-600' : 'text-rose-500'}`}>
                            {Number(data.deviation) >= 0 ? `+${data.deviation}` : data.deviation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>

            <div className="mt-auto py-6 text-center border-t border-indigo-50">
                <p className="text-[9px] font-black text-indigo-200 tracking-[1em] uppercase font-sans">Page 01</p>
            </div>
          </div>
          
          {/* 페이지 2 (추세 및 피드백) */}
          <div className="report-page shadow-2xl bg-white print:shadow-none print:m-0 page-break-before font-sans">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                <span className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-sm shadow-lg shadow-indigo-200 font-sans">03</span>
                <span className="italic uppercase text-indigo-900 tracking-tight">Performance Trend Analysis</span>
              </h3>
              <div className="grid grid-cols-2 gap-8 mb-10">
                {reportData.map((data, i) => (
                  <div key={i} className="bg-white rounded-[2.5rem] p-8 border-2 border-indigo-50 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-xl text-indigo-900 border-l-4 border-indigo-600 pl-4">{data.subject}</h4>
                        <span className="text-[9px] bg-indigo-50 text-indigo-400 px-3 py-1.5 rounded-full font-black uppercase tracking-widest font-sans">Trend</span>
                    </div>
                    <div className="w-full h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.sessions} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2ff" />
                          <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold', fill: '#818cf8'}} />
                          <YAxis domain={[0, data.maxStandard]} hide />
                          <Tooltip />
                          <Legend iconType="circle" wrapperStyle={{paddingTop: '15px', fontSize: '11px', fontWeight: '800'}} />
                          <Line type="monotone" dataKey="score" name="내 점수" stroke="#4f46e5" strokeWidth={5} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }} />
                          <Line type="monotone" dataKey="average" name="반 평균" stroke="#d1d5db" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4, fill: '#d1d5db' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-auto bg-indigo-900 rounded-[3rem] p-12 relative shadow-xl min-h-[260px] flex flex-col justify-center overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                <h4 className="text-2xl font-black mb-6 flex items-center gap-4 italic uppercase tracking-tighter text-indigo-300 relative z-10 font-sans">
                  <span className="w-2 h-7 bg-indigo-400 rounded-full"></span>
                  Director's Feedback
                </h4>
                <div className="w-full h-[1px] bg-white/10 mb-8 relative z-10"></div>
                <p className="text-white leading-[2.2] whitespace-pre-wrap font-bold text-xl italic tracking-wide relative z-10">
                  {teacherComment || '이번 달 학습 성취도를 종합한 결과, 전반적으로 안정적인 흐름을 보이고 있습니다. 개별 취약 포인트에 대한 집중 관리를 통해 더 높은 성장을 이룰 수 있도록 지도하겠습니다.'}
                </p>
              </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .print\:hidden { display: none !important; }
          .report-page { 
            width: 210mm; height: 297mm; padding: 15mm 20mm; 
            margin: 0 !important; page-break-after: always;
            display: flex; flex-direction: column; border: none !important;
          }
          @page { size: A4; margin: 0; }
        }
        .report-container { width: 210mm; }
        .report-page {
          width: 210mm; min-height: 297mm; padding: 20mm;
          display: flex; flex-direction: column; box-sizing: border-box; position: relative;
        }
      `}</style>
    </div>
  );
}