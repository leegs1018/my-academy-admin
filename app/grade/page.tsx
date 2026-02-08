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
  const [studentGrades, setStudentGrades] = useState<any[]>([]);

  useEffect(() => { fetchStudents(); }, []);
  useEffect(() => { if (selectedStudent) fetchGradesForGraph(selectedStudent); }, [selectedStudent]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name');
    if (data) setStudents(data);
  };

  const fetchGradesForGraph = async (id: string) => {
    const { data } = await supabase.from('grades').select('test_name, score, max_score').eq('student_id', id).order('id', { ascending: true });
    if (data) setStudentGrades(data.map(g => ({ name: g.test_name, 백분율: Math.round((g.score / g.max_score) * 100) })));
  };

  const addGrade = async () => {
    if (!selectedStudent || !testName || !score) return alert('입력 확인!');
    const { error } = await supabase.from('grades').insert([{ student_id: selectedStudent, test_name: testName, score: parseInt(score), max_score: parseInt(maxScore) }]);
    if (!error) { setTestName(''); setScore(''); fetchGradesForGraph(selectedStudent); alert('성적 저장 완료!'); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 italic underline decoration-green-300">📝 성적 입력 & 분석</h1>
      {/* (아까 만든 성적 입력 및 그래프 섹션 코드를 여기에 그대로 넣으시면 됩니다) */}
      <div className="bg-white p-6 rounded-xl shadow-xl border-t-8 border-t-green-500">
         <select className="w-full border-2 border-indigo-100 p-4 rounded-xl text-2xl font-black mb-6 bg-indigo-50" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
           <option value="">👇 학생 선택</option>
           {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
         </select>
         {/* 그래프와 입력창 생략 (위의 코드와 동일하게 넣으세요) */}
         <button onClick={addGrade} className="w-full bg-green-600 text-white py-6 rounded-xl font-black text-3xl shadow-2xl mt-4">성 적 저 장</button>
      </div>
    </div>
  );
}