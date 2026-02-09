'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function GradePage() {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [testName, setTestName] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]); // 오늘 날짜 기본값
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchStudents(); }, []);
  useEffect(() => { if (selectedStudent) fetchGradesData(selectedStudent); }, [selectedStudent]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name');
    if (data) setStudents(data);
  };

  // 성적 데이터 가져오기 (test_date 사용)
  const fetchGradesData = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('student_id', id)
      .order('test_date', { ascending: false }); // 최신순 정렬

    if (error) {
      console.error("데이터 불러오기 에러:", error.message);
    }
    
    if (data) {
      setStudentGrades(data.map(g => ({
        ...g,
        name: g.test_name,
        점수: g.score,
        백분율: Math.round((g.score / g.max_score) * 100)
      })));
    }
    setLoading(false);
  };

  const addGrade = async () => {
    if (!selectedStudent || !testName || !score) return alert('빈칸을 모두 채워주세요!');
    
    setLoading(true);

    const payload = {
      student_id: selectedStudent, 
      test_name: testName,
      score: Number(score),
      max_score: Number(maxScore),
      test_date: testDate // 원장님 DB 컬럼명에 맞춤
    };

    const { error } = await supabase.from('grades').insert([payload]);

    if (error) {
      alert(`저장 실패! 이유: ${error.message}`);
    } else {
      alert('성적 저장 완료! ✅');
      setTestName('');
      setScore('');
      fetchGradesData(selectedStudent);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      <h1 className="text-4xl font-black text-gray-800 italic flex items-center gap-3">
        <span className="bg-green-500 w-3 h-10 rounded-full"></span>
        성적 입력 및 분석
      </h1>

      {/* 1. 학생 선택 */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-black">
        <select 
          className="w-full border-4 border-indigo-100 p-4 rounded-2xl text-2xl font-black bg-indigo-50 outline-none"
          value={selectedStudent} 
          onChange={(e) => setSelectedStudent(e.target.value)}
        >
          <option value="">👇 학생을 선택해 주세요</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {/* 그래프 */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border-4 border-black">
              <h3 className="text-2xl font-black mb-6 text-indigo-600">📊 성적 추이 (백분율)</h3>
              <div className="h-[300px] w-full">
                {studentGrades.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...studentGrades].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="백분율" stroke="#4f46e5" strokeWidth={5} dot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 font-bold italic">데이터 없음</div>
                )}
              </div>
            </div>

            {/* 입력창 */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border-4 border-black space-y-4">
              <h3 className="text-2xl font-black text-green-600">➕ 성적 추가</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="date" className="w-full border-4 border-gray-100 p-4 rounded-xl text-xl font-bold bg-gray-50"
                  value={testDate} onChange={(e) => setTestDate(e.target.value)}
                />
                <input 
                  type="text" className="w-full border-4 border-gray-100 p-4 rounded-xl text-xl font-bold bg-gray-50"
                  placeholder="시험명 (예: 2월 단어테스트)" value={testName} onChange={(e) => setTestName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" className="w-full border-4 border-gray-100 p-4 rounded-xl text-xl font-bold bg-gray-50" placeholder="점수" value={score} onChange={(e) => setScore(e.target.value)} />
                <input type="number" className="w-full border-4 border-gray-100 p-4 rounded-xl text-xl font-bold bg-gray-50" placeholder="만점" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
              </div>
              <button onClick={addGrade} disabled={loading} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black text-2xl shadow-[0_6px_0_0_rgba(21,128,61,1)]">
                {loading ? '저장 중...' : '저장하기 ✅'}
              </button>
            </div>
          </div>

          {/* 히스토리 */}
          <div className="bg-white p-6 rounded-[2rem] shadow-xl border-4 border-black flex flex-col">
            <h3 className="text-2xl font-black mb-6 text-gray-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-orange-400 rounded-full"></span>
              히스토리
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2" style={{ maxHeight: '700px' }}>
              {studentGrades.length > 0 ? studentGrades.map((g) => (
                <div key={g.id} className="p-4 border-2 border-gray-100 rounded-2xl">
                  <div className="font-black text-gray-800">{g.test_name}</div>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-2xl font-black text-indigo-600">{g.score}<span className="text-sm text-gray-400">/{g.max_score}</span></span>
                    <span className="text-sm font-bold text-gray-400">{g.test_date}</span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-400 font-bold py-10">기록이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}