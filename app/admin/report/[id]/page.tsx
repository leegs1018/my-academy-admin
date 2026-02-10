'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
  const { id } = React.use(params);
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

      // 1. 학생 정보 가져오기 (여기서 class_name을 얻습니다)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) return;
      setStudentInfo(student);

      // 2. 내 성적 데이터 가져오기 (grades 테이블)
      const { data: myScores, error: scoreError } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', id)
        .order('test_date', { ascending: true });

      if (scoreError) throw scoreError;

      // 3. 반 평균 계산 로직 (중요!)
      let totalClassAvg = 0;
      if (student.class_name) {
        // (A) 같은 반 학생들의 ID 목록을 먼저 가져옵니다.
        const { data: classMates } = await supabase
          .from('students')
          .select('id')
          .eq('class_name', student.class_name);
        
        const mateIds = classMates?.map(m => m.id) || [];

        if (mateIds.length > 0) {
          // (B) 그 학생들의 모든 성적을 grades 테이블에서 가져옵니다.
          const { data: allClassScores } = await supabase
            .from('grades')
            .select('score')
            .in('student_id', mateIds);
          
          if (allClassScores && allClassScores.length > 0) {
            totalClassAvg = Math.round(allClassScores.reduce((a, b) => a + b.score, 0) / allClassScores.length);
          }
        }
      }

      // 4. 차트용 데이터 가공
      if (myScores && myScores.length > 0) {
        const categories = Array.from(new Set(myScores.map(s => s.test_name)));
        const rounds = Array.from({ length: 10 }, (_, i) => `${i + 1}회차`);
        
        const scoresByCategory: any = {};
        const categoryAverages: number[] = [];

        categories.forEach(cat => {
          const catScores = myScores.filter(s => s.test_name === cat).map(s => s.score);
          scoresByCategory[cat] = catScores;
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

  if (loading) return <div className="p-10 text-center font-black text-indigo-600 text-xl">성적 데이터를 불러오는 중...</div>;
  if (!studentInfo) return <div className="p-10 text-center font-black">학생 정보를 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-4 border-indigo-600">
        
        {/* 헤더 섹션 */}
        <div className="flex justify-between items-end mb-10 border-b-4 border-gray-100 pb-6">
          <div>
            <div className="flex gap-2 mb-2">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black">
                {studentInfo.class_name || '클래스 미지정'}
              </span>
              <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs font-black">
                {studentInfo.school_name} {studentInfo.grade_level}
              </span>
            </div>
            <h1 className="text-5xl font-black text-gray-900 leading-tight">
              <span className="text-indigo-600">{studentInfo.name}</span> 학생<br />성적 리포트
            </h1>
          </div>
          <div className="text-right font-black">
            <p className="text-gray-400">REPORT DATE</p>
            <p className="text-xl text-gray-800">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-indigo-50 p-6 rounded-[2rem] text-center border-2 border-indigo-100">
            <p className="text-indigo-600 font-black mb-1 text-sm">종합 평균</p>
            <p className="text-4xl font-black text-indigo-900">{stats.myAvg}점</p>
          </div>
          <div className="bg-gray-50 p-6 rounded-[2rem] text-center border-2 border-gray-100">
            <p className="text-gray-500 font-black mb-1 text-sm">클래스 평균</p>
            <p className="text-4xl font-black text-gray-700">{stats.classAvg}점</p>
          </div>
          <div className={`${stats.growth >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} p-6 rounded-[2rem] text-center border-2`}>
            <p className="font-black mb-1 text-sm">평균 대비</p>
            <p className={`text-4xl font-black ${stats.growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {stats.growth >= 0 ? `+${stats.growth}` : stats.growth}점
            </p>
          </div>
        </div>

        {/* 메인 차트 */}
        {reportData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl border-2 border-gray-50 shadow-sm">
              <h3 className="font-black text-lg mb-4 text-gray-800">📊 성적 추이 (최근 10회)</h3>
              <Line 
                data={{
                  labels: reportData.rounds,
                  datasets: reportData.categories.map((cat: string, i: number) => ({
                    label: cat,
                    data: reportData.scoresByCategory[cat],
                    borderColor: ['#4F46E5', '#10B981', '#F59E0B'][i % 3],
                    backgroundColor: ['#4F46E5', '#10B981', '#F59E0B'][i % 3],
                    tension: 0.3,
                  }))
                }}
              />
            </div>
            <div className="bg-white p-6 rounded-3xl border-2 border-gray-50 shadow-sm flex flex-col items-center">
              <h3 className="font-black text-lg mb-4 text-gray-800 self-start">🕸 학습 밸런스</h3>
              <div className="w-full max-w-[320px]">
                <Radar 
                  data={{
                    labels: reportData.categories,
                    datasets: [{
                      label: '영역별 평균 점수',
                      data: reportData.categoryAverages,
                      backgroundColor: 'rgba(79, 70, 229, 0.2)',
                      borderColor: '#4F46E5',
                      borderWidth: 3,
                    }]
                  }}
                  options={{ scales: { r: { beginAtZero: true, max: 100 } } }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-20 rounded-3xl text-center border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-black">해당 학생의 성적 데이터가 아직 없습니다. 📝</p>
          </div>
        )}
      </div>
    </div>
  );
}