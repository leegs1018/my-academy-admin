'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    studentPhone: '',
    parentPhone: '',
    parentRelation: '어머님 (모)', 
    admissionDate: new Date().toISOString().split('T')[0],
    gender: '남',
    birthDate: '',
    className: '', 
    schoolName: '',
    gradeYear: '2024',
    schoolLevel: '초등', 
    gradeLevel: '1학년', 
    counselingMemo: '',
    isPhoneSame: false 
  });

  useEffect(() => { 
    fetchStudents();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (formData.isPhoneSame) {
      setFormData(prev => ({ ...prev, studentPhone: prev.parentPhone }));
    }
  }, [formData.isPhoneSame, formData.parentPhone]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (data) setStudents(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('class_name', { ascending: true });
    if (data) setClassList(data);
  };

  const getGradeOptions = () => {
    switch (formData.schoolLevel) {
      case '유치': return ['4세', '5세', '6세', '7세'];
      case '초등': return ['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'];
      case '중등': 
      case '고등': return ['1학년', '2학년', '3학년'];
      default: return []; 
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert('이름은 필수입니다!');
    const { error } = await supabase.from('students').insert([{
      name: formData.name,
      student_phone: formData.studentPhone,
      parent_phone: formData.parentPhone,
      parent_relation: formData.parentRelation,
      admission_date: formData.admissionDate,
      gender: formData.gender,
      birth_date: formData.birthDate,
      class_name: formData.className,
      school_name: formData.schoolName,
      grade_year: formData.gradeYear,
      school_level: formData.schoolLevel,
      grade_level: formData.gradeLevel,
      counseling_memo: formData.counselingMemo
    }]);

    if (!error) {
      alert('등록 완료!');
      setFormData({
        name: '', studentPhone: '', parentPhone: '', parentRelation: '어머님 (모)',
        admissionDate: new Date().toISOString().split('T')[0],
        gender: '남', birthDate: '', className: '', schoolName: '', 
        gradeYear: '2024', schoolLevel: '초등', gradeLevel: '1학년', counselingMemo: '',
        isPhoneSame: false
      });
      fetchStudents();
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-black text-indigo-700 border-b-4 border-indigo-100 pb-2">👤 학생 상세 등록</h1>

      <div className="bg-white rounded-2xl shadow-xl border p-8 space-y-6">
        {/* 학생 기본 정보 & 성별 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2">학생 성함 *</label>
            <input className="w-full border-2 p-3 rounded-lg text-lg font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="이름 입력" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2">성별</label>
            <div className="flex gap-4 p-3 border-2 rounded-lg bg-gray-50">
              {['남', '여'].map(g => (
                <label key={g} className="flex-1 flex items-center justify-center gap-2 cursor-pointer font-bold">
                  <input type="radio" checked={formData.gender === g} onChange={() => setFormData({...formData, gender: g})} className="w-5 h-5 accent-indigo-600" /> {g}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 날짜 정보 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/20 p-5 rounded-2xl border border-blue-50">
          <div>
            <label className="block text-sm font-bold text-blue-600 mb-1">학생 생년월일</label>
            <input type="date" className="w-full border-2 p-3 rounded-lg font-medium" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-600 mb-1">학원 입학일</label>
            <input type="date" className="w-full border-2 p-3 rounded-lg font-medium" value={formData.admissionDate} onChange={e => setFormData({...formData, admissionDate: e.target.value})} />
          </div>
        </div>

        {/* 연락처 섹션 */}
        <div className="p-5 border-2 border-indigo-50 rounded-2xl bg-indigo-50/10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-indigo-600 mb-1">보호자 연락처</label>
              <input className="w-full border-2 p-3 rounded-lg font-bold border-indigo-100 bg-white" value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} placeholder="010-0000-0000" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-bold text-gray-500">학생 번호</label>
                <label className="flex items-center gap-1 text-xs font-bold text-indigo-500 cursor-pointer">
                  <input type="checkbox" checked={formData.isPhoneSame} onChange={e => setFormData({...formData, isPhoneSame: e.target.checked})} className="rounded" /> [보호자 연락처와 동일]
                </label>
              </div>
              <input className={`w-full border-2 p-3 rounded-lg ${formData.isPhoneSame ? 'bg-gray-100 text-gray-400' : 'bg-white font-bold border-indigo-100'}`} 
                value={formData.studentPhone} onChange={e => !formData.isPhoneSame && setFormData({...formData, studentPhone: e.target.value})} placeholder="010-0000-0000" disabled={formData.isPhoneSame} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-500 mb-1">보호자 구분</label>
            <select className="w-full border-2 p-3 rounded-lg font-bold text-gray-700" value={formData.parentRelation} onChange={e => setFormData({...formData, parentRelation: e.target.value})}>
              <option value="어머님 (모)">어머님 (모)</option>
              <option value="아버님 (부)">아버님 (부)</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>

        {/* 학년 및 학교/클래스 정보 섹션 */}
        <div className="p-5 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-6">
           {/* 학년 선택 (가로 3줄) */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase">학년 기준연도</label>
                <select className="w-full border p-2 rounded-lg font-bold shadow-sm" value={formData.gradeYear} onChange={e => setFormData({...formData, gradeYear: e.target.value})}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년도</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase">구분 (학교급)</label>
                <select className="w-full border p-2 rounded-lg font-bold shadow-sm" value={formData.schoolLevel} onChange={e => {
                  const level = e.target.value;
                  setFormData({
                    ...formData, 
                    schoolLevel: level, 
                    gradeLevel: (level === 'N수생' || level === '기타') ? '' : (level === '유치' ? '4세' : '1학년')
                  });
                }}>
                  {['유치', '초등', '중등', '고등', 'N수생', '기타'].map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-black text-gray-400 uppercase">학년 / 상세구분</label>
                {['N수생', '기타'].includes(formData.schoolLevel) ? (
                  <input 
                    className="w-full border-2 border-orange-200 p-2 rounded-lg font-bold bg-orange-50 focus:border-orange-400 outline-none shadow-sm"
                    value={formData.gradeLevel}
                    onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
                    placeholder={`${formData.schoolLevel} 상세 입력`}
                  />
                ) : (
                  <select className="w-full border-2 p-2 rounded-lg font-bold shadow-sm" value={formData.gradeLevel} onChange={e => setFormData({...formData, gradeLevel: e.target.value})}>
                    {getGradeOptions().map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
              </div>
           </div>

           {/* 학교명과 클래스 (요청하신 순서 변경!) */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase">학교명</label>
                <input className="w-full border-2 p-3 rounded-lg font-medium bg-white shadow-sm" value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} placeholder="학교 이름 (예: 대전초)" />
              </div>
              <div>
                <label className="text-xs font-black text-indigo-500 uppercase">수강 클래스 선택</label>
                <select 
                  className="w-full border-2 border-indigo-200 p-3 rounded-lg font-bold bg-white focus:border-indigo-500 outline-none shadow-sm text-indigo-900" 
                  value={formData.className} 
                  onChange={e => setFormData({...formData, className: e.target.value})}
                >
                  <option value="">클래스를 선택하세요</option>
                  {classList.map(c => (
                    <option key={c.id} value={c.class_name}>
                      [{c.target_level}] {c.class_name}
                    </option>
                  ))}
                </select>
              </div>
           </div>
        </div>

        {/* 상담 메모 */}
        <div className="space-y-2">
          <label className="block text-sm font-black text-gray-600">📋 상담 메모 및 특이사항</label>
          <textarea className="w-full border-2 p-4 rounded-xl min-h-[120px] bg-yellow-50/20 shadow-inner focus:border-yellow-400 outline-none" value={formData.counselingMemo} onChange={e => setFormData({...formData, counselingMemo: e.target.value})} placeholder="학생 성향 등 자유롭게 적어주세요." />
        </div>

        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-2xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all">
          학생 정보 저장 ✅
        </button>
      </div>
    </div>
  );
}