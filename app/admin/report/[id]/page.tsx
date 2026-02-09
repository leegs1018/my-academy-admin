'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  Title
);

export default function StudentReport({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [comment, setComment] = useState("");

  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  // 데이터 로드 (현재는 구조 확인을 위한 샘플 데이터입니다)
  useEffect(() => {
    // TODO: 실제 DB 연결 시 params.id를 사용하여 데이터를 가져올 예정입니다.
    setStudentInfo({ 
      name: "김철수", 
      className: "Level 3 - A",
      month: new Date().getMonth() + 1
    });

    setReportData({
      rounds: ['1회', '2회', '3회', '4회', '5회', '6회', '7회', '8회'],
      categories: ['단어', '듣기', '본시험'],
      // 과목별 상세 데이터
      scoresByCategory: {
        '단어': [90, 85, 95, 100, 90, 95, 100, 100],
        '듣기': [80, 80, 85, 90, 85, 90, 95, 90],
        '본시험': [70, 75, 80, 85, 82, 88, 90, 92],
      },
      averagesByCategory: {
        '단어': [85, 85, 88, 90, 88, 90, 92, 93],
        '듣기': [75, 76, 78, 80, 79, 81, 82, 83],
        '본시험': [65, 68, 70, 72, 73, 75, 78, 80],
      },
      // 레이더 차트용 이번 달 최종 성취도 (평균)
      categoryAverages: [95, 88, 82] 
    });
    setLoading(false);
  }, []);

  if (loading) return <div className="p-10 text-center font-black text-indigo-900 animate-pulse">리포트 생성 중...</div>;

  return (
    <div className="bg-slate-100 min-h-screen py-10 px-4 print:p-0 print:bg-white">
      {/* 관리자 컨트롤바 */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button onClick={() => window.history.back()} className="bg-white text-slate-500 px-5 py-2 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all border border-slate-200">← 뒤로가기</button>
        <button 
          onClick={handlePrint}
          className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
        >
          PDF 저장 / 성적표 출력 🖨️
        </button>
      </div>

      {/* 리포트 본문 (A4) */}
      <div ref={reportRef} className="max-w-[210mm] mx-auto bg-white shadow-2xl p-[15mm] sm:p-[20mm] print:shadow-none print:w-full print:p-[10mm]">
        
        {/* 1. 헤더 */}
        <div className="flex justify-between items-end border-b-8 border-indigo-600 pb-8 mb-12">
          <div>
            <img src="/logo.png" alt="학원로고" className="h-14 mb-4" />
            <h2 className="text-indigo-400 font-black text-sm tracking-[0.3em] uppercase italic">Monthly Learning Analysis</h2>
          </div>
          <div className="text-right">
            <h1 className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">성 적 리 포 트</h1>
            <p className="text-xl text-indigo-600 font-bold">{studentInfo.month}월 | {studentInfo.className} | {studentInfo.name} 학생</p>
          </div>
        </div>

        {/* 2. 상단 핵심 요약 */}
        <div className="grid grid-cols-3 gap-8 mb-14">
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-center shadow-lg shadow-indigo-100">
            <p className="text-indigo-200 text-xs font-black mb-2 uppercase tracking-widest">My Avg</p>
            <p className="text-4xl font-black text-white">92.4</p>
          </div>
          <div className="bg-white border-4 border-slate-100 p-8 rounded-[2.5rem] text-center">
            <p className="text-slate-400 text-xs font-black mb-2 uppercase tracking-widest">Class Avg</p>
            <p className="text-4xl font-black text-slate-800">84.2</p>
          </div>
          <div className="bg-amber-400 p-8 rounded-[2.5rem] text-center shadow-lg shadow-amber-100">
            <p className="text-amber-800 text-xs font-black mb-2 uppercase tracking-widest">Growth</p>
            <p className="text-4xl font-black text-white">+8.2</p>
          </div>
        </div>

        {/* 3. 과목별 상세 추이 그래프 */}
        <div className="mb-14">
          <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <span className="w-3 h-8 bg-indigo-600 rounded-full"></span>
            과목별 학습 성취도 (내 점수 vs 반 평균)
          </h3>
          
          <div className="space-y-10">
            {reportData.categories.map((cat: string) => (
              <div key={cat} className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xl font-black text-indigo-900 bg-white px-6 py-2 rounded-2xl shadow-sm border border-indigo-50">
                    {cat} 영역 추이
                  </h4>
                  <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-600 rounded-full"></span> Student</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-3 bg-slate-300 rounded-full"></span> Average</span>
                  </div>
                </div>
                <div className="h-44">
                  <Line 
                    data={{
                      labels: reportData.rounds,
                      datasets: [
                        {
                          label: '내 점수',
                          data: reportData.scoresByCategory[cat],
                          borderColor: 'rgb(79, 70, 229)',
                          backgroundColor: 'rgba(79, 70, 229, 0.1)',
                          fill: true,
                          tension: 0.4,
                          borderWidth: 4,
                          pointRadius: 4,
                          pointBackgroundColor: '#fff',
                          pointBorderWidth: 3,
                        },
                        {
                          label: '반 평균',
                          data: reportData.averagesByCategory[cat],
                          borderColor: 'rgb(203, 213, 225)',
                          borderDash: [5, 5],
                          fill: false,
                          tension: 0.4,
                          pointRadius: 0,
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, max: 100, ticks: { stepSize: 20, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 영역별 밸런스 & 코멘트 */}
        <div className="grid grid-cols-2 gap-12 pt-4">
          <div className="bg-slate-50 p-8 rounded-[3rem]">
            <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
              <span className="w-2 h-6 bg-rose-500 rounded-full"></span>
              종합 성취도 분석
            </h3>
            <div className="h-64">
              <Radar 
                data={{
                  labels: reportData.categories,
                  datasets: [{
                    label: '성취도',
                    data: reportData.categoryAverages,
                    backgroundColor: 'rgba(244, 63, 94, 0.2)',
                    borderColor: 'rgb(244, 63, 94)',
                    borderWidth: 3,
                    pointBackgroundColor: 'rgb(244, 63, 94)',
                  }]
                }}
                options={{ 
  scales: { 
    r: { 
      suggestedMin: 0, // ed 추가
      suggestedMax: 100, // ed 추가
      ticks: { display: false } 
    } 
  },
  maintainAspectRatio: false,
  plugins: { legend: { display: false } }
}}
              />
            </div>
          </div>
          
          <div className="flex flex-col">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
              <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
              원장님 학습 총평
            </h3>
            <div className="flex-1 border-4 border-amber-100 rounded-[3rem] p-8 bg-amber-50/10 shadow-inner">
              <textarea 
                className="w-full h-full bg-transparent border-none outline-none font-bold text-slate-700 leading-relaxed resize-none print:hidden placeholder:text-amber-200"
                placeholder="학생의 이번 달 학습 성과와 격려의 메시지를 남겨주세요..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="hidden print:block text-slate-700 font-bold whitespace-pre-wrap leading-loose italic">
                "{comment || "이번 달에도 성실하게 학습에 임해주어 대견합니다. 다음 달에는 부족한 영역을 보완하여 더 큰 성장을 이뤄내길 응원합니다."}"
              </p>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center mt-16 border-t-2 border-slate-100 pt-10">
          <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Education Philosophy: Trust & Growth</p>
          <p className="text-slate-900 font-black text-2xl tracking-tight">에듀마스터 어학원</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .print\:hidden { display: none !important; }
          textarea { display: none; }
        }
      `}</style>
    </div>
  );
}