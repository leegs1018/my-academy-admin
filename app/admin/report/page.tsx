'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

export default function AdminReportPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState('1월');
  const [reportData, setReportData] = useState<any[]>([]);
  const [teacherComment, setTeacherComment] = useState('');
  
  const reportRef = useRef<HTMLDivElement>(null);

  // 1. 학생 목록 가져오기
  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase.from('students').select('*').order('name');
      if (data) setStudents(data);
    };
    fetchStudents();
  }, []);

  // 2. 학생 선택 시 해당 월의 성적 데이터 시뮬레이션 (실제 DB 구조에 맞게 수정 가능)
  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
    // 예시 데이터: 과목별 학생 점수와 반 평균
    // 실제로는 supabase에서 해당 학생의 성적 테이블을 조회해야 합니다.
    const mockData = [
      { subject: '국어', score: 85, average: 78 },
      { subject: '영어', score: 92, average: 82 },
      { subject: '수학', score: 78, average: 75 },
      { subject: '과학', score: 88, average: 80 },
    ];
    setReportData(mockData);
  };

  // 3. 프린트 및 PDF 저장 기능
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen pb-20 font-sans">
      {/* 관리자 컨트롤 영역 (출력 시 숨김) */}
      <div className="max-w-[1000px] mx-auto bg-white p-6 rounded-3xl shadow-sm mb-6 print:hidden">
        <h1 className="text-2xl font-black text-indigo-700 mb-6 flex items-center gap-2">
          📊 성적 분석 및 리포트 발행
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 학생 검색 및 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500">학생 검색</label>
            <input 
              type="text" 
              placeholder="이름 검색..." 
              className="w-full border-2 p-3 rounded-xl outline-none focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="h-32 overflow-y-auto border rounded-xl mt-2 p-2 space-y-1">
              {students.filter(s => s.name.includes(searchTerm)).map(s => (
                <div 
                  key={s.id} 
                  onClick={() => handleStudentSelect(s)}
                  className={`p-2 rounded-lg cursor-pointer text-sm font-bold ${selectedStudent?.id === s.id ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}
                >
                  {s.name} ({s.school_name})
                </div>
              ))}
            </div>
          </div>

          {/* 월 선택 & 코멘트 입력 */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-black text-gray-500">분석 월</label>
                <select 
                  className="w-full border-2 p-3 rounded-xl font-bold mt-1"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={`${i+1}월`}>{i+1}월 성적 리포트</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handlePrint} className="bg-gray-800 text-white px-6 py-3 rounded-xl font-black hover:bg-black transition-all">
                  🖨️ 프린트 / PDF 저장
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-black text-gray-500">담당 선생님 코멘트</label>
              <textarea 
                className="w-full border-2 p-4 rounded-xl mt-1 h-24 resize-none outline-none focus:border-indigo-500 font-medium"
                placeholder="학습 태도 및 성적 분석 내용을 입력하세요..."
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- 리포트 미리보기 (A4 양식) --- */}
      {selectedStudent ? (
        <div 
          ref={reportRef}
          className="report-paper mx-auto bg-white shadow-2xl print:shadow-none print:m-0"
        >
          {/* 리포트 헤더 */}
          <div className="flex justify-between items-start border-b-4 border-indigo-600 pb-6 mb-8">
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter">
                STUDENT REPORT <span className="text-indigo-600">{selectedMonth}</span>
              </h2>
              <p className="text-gray-500 font-bold mt-1">개별 맞춤 성적 분석 리포트</p>
            </div>
            <div className="text-right">
              {/* 로고 자리 */}
              <div className="w-32 h-12 bg-gray-200 rounded flex items-center justify-center font-black text-gray-400 mb-2">
                ACADEMY LOGO
              </div>
              <p className="text-sm font-bold text-gray-700">{selectedStudent.name} 학생</p>
              <p className="text-xs text-gray-400">{selectedStudent.school_name} / {selectedStudent.grade_level}</p>
            </div>
          </div>

          {/* 성적 그래프 영역 */}
          <div className="mb-10">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
              과목별 성적 분석 (학생 점수 vs 반 평균)
            </h3>
            <div className="w-full h-[400px] bg-gray-50 rounded-3xl p-6 border border-gray-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{fontFamily: 'black', fill: '#374151'}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="score" name="내 점수" fill="#4f46e5" radius={[10, 10, 0, 0]} barSize={40}>
                    <LabelList dataKey="score" position="top" style={{ fontWeight: 'bold', fill: '#4f46e5' }} />
                  </Bar>
                  <Bar dataKey="average" name="반 평균" fill="#9ca3af" radius={[10, 10, 0, 0]} barSize={40}>
                    <LabelList dataKey="average" position="top" style={{ fontWeight: 'bold', fill: '#9ca3af' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 상세 점수 테이블 */}
          <div className="mb-10">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-indigo-50 text-indigo-900">
                  <th className="p-3 border-y-2 border-indigo-200">평가 과목</th>
                  <th className="p-3 border-y-2 border-indigo-200">내 점수</th>
                  <th className="p-3 border-y-2 border-indigo-200">반 평균</th>
                  <th className="p-3 border-y-2 border-indigo-200">편차</th>
                </tr>
              </thead>
              <tbody className="text-center font-bold">
                {reportData.map((d, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-4 bg-gray-50/50">{d.subject}</td>
                    <td className="p-4 text-indigo-600 text-lg">{d.score}점</td>
                    <td className="p-4 text-gray-500">{d.average}점</td>
                    <td className="p-4 font-mono text-sm">
                      {d.score - d.average > 0 ? `+${d.score - d.average}` : d.score - d.average}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 선생님 코멘트 영역 */}
          <div className="bg-gray-50 rounded-[2rem] p-8 border-2 border-dashed border-gray-200 min-h-[150px]">
            <h4 className="text-lg font-black text-indigo-700 mb-4 flex items-center gap-2">
              📝 담당 선생님 피드백
            </h4>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
              {teacherComment || '입력된 코멘트가 없습니다.'}
            </p>
          </div>

          {/* 리포트 푸터 */}
          <div className="mt-auto pt-10 text-center border-t border-gray-100">
            <p className="text-sm font-black text-gray-400 italic">"꿈을 향한 열정, 우리 학원이 함께합니다."</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400 font-bold">
          학생을 선택하면 리포트 미리보기가 표시됩니다.
        </div>
      )}

      {/* --- A4 출력을 위한 스타일 --- */}
      <style jsx global>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .print\:hidden { display: none !important; }
          .report-paper { 
            box-shadow: none !important; 
            border: none !important; 
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page { size: A4; margin: 15mm; }
        }
        .report-paper {
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}