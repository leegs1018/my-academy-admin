'use client';

import React, { useState, useEffect, use } from 'react'; // 💡 React.use 대신 깔끔하게 import
import { supabase } from '@/lib/supabase'; // 💡 공통 클라이언트 사용
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

export default function StudentReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [stats, setStats] = useState({ myAvg: 0, classAvg: 0, growth: 0 });

  useEffect(() => {
    if (id) fetchReportData();
  }, [id]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // 1. 학생 정보 가져오기
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) return;
      setStudentInfo(student);

      // 2. 내 성적 데이터 가져오기 (최신순 10개만 먼저 가져와서 처리)
      const { data: myScores, error: scoreError } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', id)
        .order('test_date', { ascending: true });

      if (scoreError) throw scoreError;

      // 3. 반 평균 계산 로직 (최적화)
      let totalClassAvg = 0;
      if (student.class_name) {
        // 💡 쿼리를 합칠 수도 있지만, 원장님의 기존 로직 흐름을 유지하되 성능을 고려했습니다.
        const { data: classMates } = await supabase
          .from('students')
          .select('id')
          .eq('class_name', student.class_name);
        
        const mateIds = classMates?.map(m => m.id) || [];

        if (mateIds.length > 0) {
          const { data: allClassScores } = await supabase
            .from('grades')
            .select('score')
            .in('student_id', mateIds);
          
          if (allClassScores && allClassScores.length > 0) {
            totalClassAvg = Math.round(allClassScores.reduce((a, b) => a + b.score, 0) / allClassScores.length);
          }
        }
      }

      // 4. 차트 데이터 가공
      if (myScores && myScores.length > 0) {
        // 중복 제거된 카테고리(과목/영역) 목록
        const categories = Array.from(new Set(myScores.map(s => s.test_name)));
        // 가로축 라벨 (데이터 개수만큼만 표시)
        const rounds = myScores.slice(-10).map((_, i) => `${i + 1}회차`);
        
        const scoresByCategory: any = {};
        const categoryAverages: number[] = [];

        categories.forEach(cat => {
          const catScores = myScores.filter(s => s.test_name === cat).map(s => s.score);
          scoresByCategory[cat] = catScores.slice(-10); // 최근 10개만 표시
          categoryAverages.push(Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length));
        });

        setReportData({
          rounds,
          categories,
          scoresByCategory,
          categoryAverages
        });

        const myTotalAvg = Math.round(myScores.reduce((a, b) => a + b.score, 0) / myScores.length);

        setStats({
          myAvg: myTotalAvg,
          classAvg: totalClassAvg,
          growth: myTotalAvg - totalClassAvg
        });
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-black text-indigo-600 text-xl">데이터 분석 중...</p>
      </div>
    </div>
  );

  if (!studentInfo) return <div className="p-10 text-center font-black">학생 정보를 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen pb-20">
      <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border-4 border-indigo-600">
        
        {/* 헤더 섹션 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b-4 border-gray-100 pb-8 gap-4">
          <div>
            <div className="flex gap-2 mb-3">
              <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase">
                {studentInfo.class_name || '클래스 미지정'}
              </span>
              <span className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-wider">
                {studentInfo.school_name} · {studentInfo.grade_level}
              </span>
            </div>
            <h1 className="text-5xl font-black text-slate-900 leading-tight tracking-tighter">
              <span className="text-indigo-600">{studentInfo.name}</span> 학생<br />
              성적 리포트
            </h1>
          </div>
          <div className="text-left md:text-right font-black">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-widest">Analysis Date</p>
            <p className="text-2xl text-slate-800">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-indigo-50 p-8 rounded-[2.5rem] text-center border-2 border-indigo-100 shadow-sm">
            <p className="text-indigo-600 font-black mb-2 text-sm uppercase tracking-widest">Total Average</p>
            <p className="text-5xl font-black text-indigo-900">{stats.myAvg}<span className="text-xl ml-1">점</span></p>
          </div>
          <div className="bg-slate-50 p-8 rounded-[2.5rem] text-center border-2 border-slate-100 shadow-sm">
            <p className="text-slate-500 font-black mb-2 text-sm uppercase tracking-widest">Class Average</p>
            <p className="text-5xl font-black text-slate-700">{stats.classAvg}<span className="text-xl ml-1">점</span></p>
          </div>
          <div className={`${stats.growth >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'} p-8 rounded-[2.5rem] text-center border-2 shadow-sm`}>
            <p className={`${stats.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-black mb-2 text-sm uppercase tracking-widest`}>Performance</p>
            <p className={`text-5xl font-black ${stats.growth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {stats.growth >= 0 ? `+${stats.growth}` : stats.growth}<span className="text-xl ml-1">점</span>
            </p>
          </div>
        </div>

        {/* 메인 차트 */}
        {reportData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">📊</span> 성적 추이
                </h3>
                <span className="text-xs font-bold text-slate-400">최근 10회차 기준</span>
              </div>
              <Line 
                data={{
                  labels: reportData.rounds,
                  datasets: reportData.categories.map((cat: string, i: number) => ({
                    label: cat,
                    data: reportData.scoresByCategory[cat],
                    borderColor: ['#4F46E5', '#10B981', '#F59E0B'][i % 3],
                    backgroundColor: ['#4F46E5', '#10B981', '#F59E0B'][i % 3],
                    tension: 0.4, // 💡 곡선을 더 부드럽게
                    pointRadius: 6,
                    pointHoverRadius: 8,
                  }))
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold' } } } },
                  scales: { y: { beginAtZero: true, max: 100 } }
                }}
              />
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-8">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">🕸️</span> 학습 밸런스
                </h3>
                <span className="text-xs font-bold text-slate-400">영역별 평균</span>
              </div>
              <div className="w-full max-w-[340px] py-4">
                <Radar 
                  data={{
                    labels: reportData.categories,
                    datasets: [{
                      label: '나의 강점/약점',
                      data: reportData.categoryAverages,
                      backgroundColor: 'rgba(79, 70, 229, 0.15)',
                      borderColor: '#4F46E5',
                      borderWidth: 4,
                      pointBackgroundColor: '#4F46E5',
                    }]
                  }}
                  options={{ 
                    scales: { 
                      r: { 
                        beginAtZero: true, 
                        max: 100,
                        ticks: { display: false },
                        pointLabels: { font: { size: 14, weight: 'bold' } } 
                      } 
                    },
                    plugins: { legend: { display: false } }
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 p-24 rounded-[3rem] text-center border-2 border-dashed border-slate-200">
            <span className="text-6xl mb-6 block">📝</span>
            <p className="text-slate-400 font-black text-xl">분석할 성적 데이터가 아직 없습니다.</p>
            <p className="text-slate-300 font-bold mt-2">학생의 성적을 먼저 입력해주세요!</p>
          </div>
        )}

        {/* 하단 푸터 (인쇄 시 보임) */}
        <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-center opacity-50">
          <p className="text-xs font-bold text-slate-400">© 2026 CLASSHUB ACADEMY MANAGEMENT SYSTEM</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center rotate-3">
              <span className="text-yellow-400 font-black text-[10px] italic">C</span>
            </div>
            <span className="text-xs font-black text-slate-900">클래스허브</span>
          </div>
        </div>
      </div>
    </div>
  );
}