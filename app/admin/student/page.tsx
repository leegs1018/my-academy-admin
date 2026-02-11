'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function StudentPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
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

  const headerMap: { [key: string]: string } = {
    '학생이름': 'name',
    '학생번호': 'student_phone',
    '보호자번호': 'parent_phone',
    '보호자관계': 'parent_relation',
    '입학일': 'admission_date',
    '성별': 'gender',
    '생년월일': 'birth_date',
    '클래스명': 'class_name',
    '학교명': 'school_name',
    '기준연도': 'grade_year',
    '구분': 'school_level',
    '학년': 'grade_level',
    '상담메모': 'counseling_memo'
  };

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

  const formatDate = (val: string) => {
    if (!val) return null;
    return val.replace(/\./g, '-').replace(/\//g, '-');
  };

 // 📥 엑셀 양식 다운로드 함수 (예시 데이터 포함)
  const downloadExcelTemplate = () => {
    // 1행: 제목
    const headers = ["학생이름", "학생번호", "보호자번호", "보호자관계", "입학일", "성별", "생년월일", "클래스명", "학교명", "기준연도", "구분", "학년", "상담메모"];
    
    // 2행: 예시 데이터 (원장님 학원에 맞게 수정 가능)
    const example = ["홍길동", "010-1234-5678", "010-9876-5432", "어머님 (모)", "2024-03-01", "남", "2015-05-05", "수학A반", "서울초", "2024", "초등", "3학년", "성격이 밝고 수리에 밝음"];
    
    // 제목과 예시를 합침
    const csvContent = headers.join(",") + "\n" + example.join(",");
    
    // 한글 깨짐 방지 (\ufeff) 및 다운로드 처리
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "학생등록_양식_예시포함.csv");
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('1행은 제목, 2행부터는 데이터입니다. 업로드하시겠습니까?')) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length < 2) throw new Error("등록할 데이터(2행)가 없습니다.");

        const rawHeaders = lines[0].split(',').map(h => h.trim());
        const englishHeaders = rawHeaders.map(h => headerMap[h] || null);
        
        const existingClassNames = new Set(classList.map(c => c.class_name));
        const invalidClasses = new Set<string>();
        
        const studentsToInsert = lines.slice(1).map((line) => {
          const values = line.split(',').map(v => v.trim());
          if (!values[0]) return null;

          const student: any = {};
          englishHeaders.forEach((header, index) => {
            if (!header) return; 
            let val = values[index];
            if (header === 'birth_date' || header === 'admission_date') {
              student[header] = formatDate(val);
            } else {
              student[header] = val === "" ? null : val;
            }
          });

          if (student.class_name && !existingClassNames.has(student.class_name)) {
            invalidClasses.add(student.class_name);
          }
          return student;
        }).filter(Boolean);

        if (invalidClasses.size > 0) {
          throw new Error(`등록되지 않은 클래스명: [${Array.from(invalidClasses).join(', ')}]`);
        }

        const { error } = await supabase.from('students').insert(studentsToInsert);
        if (error) throw error;

        alert(`성공! 총 ${studentsToInsert.length}명의 학생을 등록했습니다. ✨`);
        fetchStudents();
      } catch (err: any) {
        alert(`오류: ${err.message}`);
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'EUC-KR');
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
      birth_date: formData.birthDate || null, 
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
    } else {
      alert('저장 오류: ' + error.message);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-end border-b-4 border-indigo-100 pb-2">
        <h1 className="text-3xl font-black text-indigo-700">👤 학생 상세 등록</h1>
        
        {/* 💡 양식 다운로드와 업로드 버튼 영역 */}
        <div className="flex gap-2">
          <button 
            onClick={downloadExcelTemplate}
            className="px-4 py-2 rounded-xl font-black text-sm bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 transition-all shadow-md"
          >
            📋 양식 다운로드
          </button>

          <label className={`cursor-pointer px-4 py-2 rounded-xl font-black text-sm transition-all shadow-md ${isUploading ? 'bg-gray-400 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            {isUploading ? '업로드 중...' : '📥 엑셀 일괄 등록'}
            <input type="file" accept=".csv" className="hidden" onChange={handleExcelUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      {/* 입력 폼 영역 (기존과 동일) */}
      <div className="bg-white rounded-2xl shadow-xl border p-8 space-y-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/20 p-5 rounded-2xl border border-blue-50">
          <div>
            <label className="block text-sm font-bold text-blue-600 mb-1">학생 생년월일 (선택)</label>
            <input type="date" className="w-full border-2 p-3 rounded-lg font-medium" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-600 mb-1">학원 입학일</label>
            <input type="date" className="w-full border-2 p-3 rounded-lg font-medium" value={formData.admissionDate} onChange={e => setFormData({...formData, admissionDate: e.target.value})} />
          </div>
        </div>

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

        <div className="p-5 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-6">
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

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="text-xs font-black text-gray-400 uppercase">학교명</label>
               <input className="w-full border-2 p-2 rounded-lg font-medium bg-white shadow-sm" value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} placeholder="학교 이름 (예: 대전초)" />
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