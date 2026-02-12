'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { utils, writeFile } from 'xlsx';

export default function StudentListPage() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); 
  const [filterSchool, setFilterSchool] = useState('');
  const [filterSchoolLevel, setFilterSchoolLevel] = useState('');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [filterClass, setFilterClass] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [newMemo, setNewMemo] = useState(''); 

  const schoolLevels = ['유치', '초등', '중등', '고등', 'N수생', '기타'];
  const parentRelations = ['어머님 (모)', '아버님 (부)', '기타'];

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  // 데이터를 가져올 때 상태 명칭을 정리하는 함수
  const cleanStatus = (status: string) => {
    if (!status) return '재원';
    // '재학', '재학중' -> '재원'으로 변경
    if (status.includes('재학')) return '재원';
    // '휴원중', '퇴원중' 등 '중'자 제거
    return status.replace('중', ''); 
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name', { ascending: true });
    if (data) {
      const cleanedData = data.map(s => ({
        ...s,
        status: cleanStatus(s.status)
      }));
      setStudents(cleanedData);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('class_name').order('class_name', { ascending: true });
    if (data) setClassList(data);
  };

  const downloadExcel = () => {
    if (filteredStudents.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const excelData = filteredStudents.map(s => ({
      이름: s.name,
      상태: s.status, 
      학교: s.school_name || '-',
      학교급: s.school_level || '-',
      학년: s.grade_level || '-',
      클래스: s.class_name || '미배정',
      학생연락처: s.student_phone || '-',
      보호자연락처: s.parent_phone || '-',
      관계: s.parent_relation || '-',
      성별: s.gender || '-',
      입학일: s.admission_date || '-'
    }));

    const worksheet = utils.json_to_sheet(excelData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "학생명단");
    writeFile(workbook, `학원_학생명단_${new Date().toLocaleDateString()}.xlsx`);
  };

  const existingSchoolLevels = Array.from(new Set(students.map(s => s.school_level).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b)));

  const getGradeOptions = (level: string) => {
    switch (level) {
      case '유치': return ['4세', '5세', '6세', '7세'];
      case '초등': return ['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'];
      case '중등':
      case '고등': return ['1학년', '2학년', '3학년'];
      case 'N수생': return ['졸업/기타'];
      case '기타': return ['기타'];
      default: return [];
    }
  };

  const schoolList = Array.from(new Set(students.map(s => s.school_name).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b)));

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.includes(searchTerm) || 
                         (s.student_phone && s.student_phone.includes(searchTerm)) ||
                         (s.parent_phone && s.parent_phone.includes(searchTerm));
    const matchesStatus = filterStatus === '' || s.status === filterStatus;
    const matchesSchool = filterSchool === '' || s.school_name === filterSchool;
    const matchesSchoolLevel = filterSchoolLevel === '' || s.school_level === filterSchoolLevel;
    const matchesGradeLevel = filterGradeLevel === '' || s.grade_level === filterGradeLevel;
    const matchesClass = filterClass === '' || s.class_name === filterClass;
    return matchesSearch && matchesStatus && matchesSchool && matchesSchoolLevel && matchesGradeLevel && matchesClass;
  });

  const deleteStudent = async (id: string, name: string) => {
    if (!confirm(`${name} 학생의 모든 기록이 삭제됩니다. 정말 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (!error) {
      alert('삭제되었습니다.');
      fetchStudents();
    }
  };

  const openEditModal = (student: any) => {
    let memoArray = [];
    try {
      memoArray = student.counseling_memo ? JSON.parse(student.counseling_memo) : [];
      if (!Array.isArray(memoArray)) memoArray = [];
    } catch (e) {
      memoArray = student.counseling_memo ? [{ date: new Date().toLocaleDateString(), content: student.counseling_memo }] : [];
    }
    
    setEditingStudent({ 
      ...student, 
      memoArray, 
      status: student.status, 
      caution_level: student.caution_level || 0, 
      grade_year: student.grade_year || '',
      isPhoneSame: student.student_phone === student.parent_phone 
    });
    setNewMemo('');
    setIsEditModalOpen(true);
  };

  const addMemo = () => {
    if (!newMemo.trim()) return;
    const today = new Date().toLocaleDateString();
    const updatedMemos = [{ date: today, content: newMemo }, ...editingStudent.memoArray];
    setEditingStudent({ ...editingStudent, memoArray: updatedMemos });
    setNewMemo('');
  };

  const deleteMemo = (index: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    const updatedMemos = [...editingStudent.memoArray];
    updatedMemos.splice(index, 1);
    setEditingStudent({ ...editingStudent, memoArray: updatedMemos });
  };

  const handleUpdate = async () => {
    try {
      const { isPhoneSame, memoArray, ...updateData } = editingStudent;
      const finalData = { 
        ...updateData, 
        student_phone: isPhoneSame ? editingStudent.parent_phone : editingStudent.student_phone, 
        counseling_memo: JSON.stringify(memoArray), 
        caution_level: Number(editingStudent.caution_level) 
      };
      const { error } = await supabase.from('students').update(finalData).eq('id', editingStudent.id);
      if (error) throw error;
      alert('수정되었습니다! ✅');
      setIsEditModalOpen(false);
      fetchStudents();
    } catch (error: any) { alert(`저장 실패: ${error.message}`); }
  };

  const renderDucks = (level: number) => {
    if (level === 0) return <span>🥚</span>;
    const ducks = [];
    for (let i = 0; i < level; i++) ducks.push(<span key={i}>🐤</span>);
    return ducks;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 pb-20 font-sans bg-gray-50/30 min-h-screen text-gray-800">
      
      {/* 헤더 영역 */}
      <div className="flex justify-between items-center border-b-4 border-indigo-100 pb-6">
        <h1 className="text-3xl font-black text-indigo-700 tracking-tight">📋 학생 통합 명부</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => router.push('/admin/student')} 
            className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl hover:bg-blue-700 font-black shadow-lg transition-all active:scale-95"
          >
            학생 등록 ➕
          </button>
          <button 
            onClick={downloadExcel} 
            className="bg-emerald-50 text-emerald-600 px-6 py-2.5 rounded-2xl hover:bg-emerald-600 hover:text-white font-black shadow-md transition-all border border-emerald-100 flex items-center gap-2"
          >
            엑셀 저장 📥
          </button>
        </div>
      </div>

     {/* 필터 영역 - 순서: 이름/연락처 -> 모든상태 -> 모든클래스 -> 모든학교 -> 학교레벨 -> 학년 -> 초기화 */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 bg-white p-5 rounded-3xl shadow-sm border border-gray-100 font-bold text-sm">
  
  {/* 1. 이름/연락처 검색 */}
  <input 
    className="border-2 p-3 rounded-2xl focus:border-indigo-500 outline-none bg-gray-50/50" 
    placeholder="이름/연락처 검색..." 
    value={searchTerm} 
    onChange={(e) => setSearchTerm(e.target.value)} 
  />
  
  {/* 2. 모든 상태 */}
  <select 
    className="border-2 p-3 rounded-2xl bg-indigo-50/50 font-black text-indigo-600 outline-none" 
    value={filterStatus} 
    onChange={(e) => setFilterStatus(e.target.value)}
  >
    <option value="">✅ 모든 상태</option>
    <option value="재원">재원</option>
    <option value="휴원">휴원</option>
    <option value="퇴원">퇴원</option>
  </select>

  {/* 3. 모든 클래스 */}
  <select 
    className="border-2 p-3 rounded-2xl bg-gray-50/50 outline-none" 
    value={filterClass} 
    onChange={(e) => setFilterClass(e.target.value)}
  >
    <option value="">📖 모든 클래스</option>
    {classList.map((c, i) => <option key={i} value={c.class_name}>{c.class_name}</option>)}
  </select>

  {/* 4. 모든 학교 */}
  <select 
    className="border-2 p-3 rounded-2xl bg-gray-50/50 outline-none" 
    value={filterSchool} 
    onChange={(e) => setFilterSchool(e.target.value)}
  >
    <option value="">🏫 모든 학교</option>
    {schoolList.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
  </select>

  {/* 5. 학교 레벨 */}
  <select 
    className="border-2 p-3 rounded-2xl bg-gray-50/50 outline-none text-blue-600 font-black" 
    value={filterSchoolLevel} 
    onChange={(e) => { setFilterSchoolLevel(e.target.value); setFilterGradeLevel(''); }}
  >
    <option value="">🎓 학교레벨 전체</option>
    {existingSchoolLevels.map(sl => <option key={sl} value={sl as string}>{sl as string}</option>)}
  </select>

  {/* 6. 학년 */}
  <select 
    className="border-2 p-3 rounded-2xl bg-gray-50/50 outline-none text-blue-600 font-black" 
    value={filterGradeLevel} 
    onChange={(e) => setFilterGradeLevel(e.target.value)}
  >
    <option value="">📅 학년 전체</option>
    {filterSchoolLevel && getGradeOptions(filterSchoolLevel).map(gl => <option key={gl} value={gl}>{gl}</option>)}
  </select>

  {/* 7. 초기화 버튼 */}
  <button 
    onClick={() => {
      setSearchTerm(''); 
      setFilterStatus(''); 
      setFilterClass(''); 
      setFilterSchool(''); 
      setFilterSchoolLevel(''); 
      setFilterGradeLevel('');
    }} 
    className="bg-gray-800 text-white py-3 rounded-2xl hover:bg-black transition-all font-black"
  >
    초기화
  </button>
</div>

      {/* 명단 테이블 */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead className="bg-gray-50 text-indigo-900 border-b-2 border-indigo-50 font-black text-xs text-center uppercase tracking-wider">
            <tr>
              <th className="p-5 text-left">이름</th>
              <th className="p-5">상태</th>
              <th className="p-5 text-left">학교 / 학년</th>
              <th className="p-5">비고</th>
              <th className="p-5">학생 연락처</th>
              <th className="p-5 text-left">보호자 연락처</th>
              <th className="p-5">성별</th>
              <th className="p-5">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm text-center">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="hover:bg-indigo-50/30 transition-all font-medium">
                <td className="p-5 text-left">
                  <span onClick={() => openEditModal(s)} className="font-black text-indigo-600 text-lg cursor-pointer hover:underline underline-offset-4 decoration-2">{s.name}</span>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1.5 rounded-full text-[11px] font-black border ${
                    s.status === '휴원' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                    s.status === '퇴원' ? 'bg-red-50 text-red-600 border-red-100' : 
                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="p-5 text-left">
                  <div className="font-bold text-gray-700">{s.school_name || '-'}</div>
                  <div className="text-[11px] text-indigo-400 font-bold">{s.school_level} {s.grade_level}</div>
                </td>
                <td className="p-5 text-xl">{renderDucks(s.caution_level || 0)}</td>
                <td className="p-5 font-mono font-bold text-gray-600">{s.student_phone || '-'}</td>
                <td className="p-5 text-left">
                  <div className="font-mono font-bold text-gray-800">{s.parent_phone || '-'}</div>
                  <div className="text-[10px] text-gray-400 font-black">{s.parent_relation}</div>
                </td>
                <td className="p-5 font-bold text-gray-400">{s.gender}</td>
                <td className="p-5">
                  <div className="flex justify-center gap-2">
                   <button 
  onClick={() => router.push(`/student/report/${s.id}`)} 
  className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-xs font-black border border-amber-100 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
>
  성적표 📈
</button>
                    <button onClick={() => openEditModal(s)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black border hover:bg-indigo-600 hover:text-white transition-all">수정</button>
                    <button onClick={() => deleteStudent(s.id, s.name)} className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black border hover:bg-red-500 hover:text-white transition-all">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 수정 모달 영역 */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl max-h-[95vh] flex flex-col overflow-hidden border border-white/20">
            <div className="p-7 border-b flex justify-between items-center bg-indigo-600 text-white font-black">
              <h2 className="text-2xl tracking-tight">{editingStudent.name} 학생 상세 수정</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 text-2xl">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 text-sm">
              <div className="space-y-8">
                <h3 className="font-black text-xl text-gray-800 underline decoration-indigo-200 decoration-8 underline-offset-4">학적 및 인적 사항</h3>
                
                <div className="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">학생 상태</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black bg-white text-indigo-600 outline-none" 
                      value={editingStudent.status} onChange={e => setEditingStudent({...editingStudent, status: e.target.value})}>
                      <option value="재원">재원</option>
                      <option value="휴원">휴원</option>
                      <option value="퇴원">퇴원</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">비고</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black bg-white text-orange-600 outline-none" 
                      value={editingStudent.caution_level} onChange={e => setEditingStudent({...editingStudent, caution_level: Number(e.target.value)})}>
                      <option value={0}>🥚</option>
                      <option value={1}>🐤</option>
                      <option value={2}>🐤🐤</option>
                      <option value={3}>🐤🐤🐤</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">이름</label>
                    <input className="w-full border-2 p-3.5 rounded-2xl font-black text-gray-700 outline-none" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">성별</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black text-gray-700 outline-none text-center" value={editingStudent.gender} onChange={e => setEditingStudent({...editingStudent, gender: e.target.value})}>
                      <option value="남">남</option><option value="여">여</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">생년월일</label>
                    <input type="date" className="w-full border-2 p-3 rounded-2xl font-black text-indigo-700 outline-none" 
                      value={editingStudent.birth_date || ''} onChange={e => setEditingStudent({...editingStudent, birth_date: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-indigo-500 ml-1">학교 구분</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black bg-indigo-50/50 text-indigo-700 outline-none" 
                      value={editingStudent.school_level || ''} 
                      onChange={e => setEditingStudent({...editingStudent, school_level: e.target.value, grade_level: getGradeOptions(e.target.value)[0] || ''})}>
                      <option value="">선택</option>
                      {schoolLevels.map(sl => <option key={sl} value={sl}>{sl}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">학교명</label>
                    <input className="w-full border-2 p-3.5 rounded-2xl font-black text-gray-700 outline-none" 
                      value={editingStudent.school_name || ''} onChange={e => setEditingStudent({...editingStudent, school_name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">학년</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black text-gray-700 outline-none" value={editingStudent.grade_level || ''} onChange={e => setEditingStudent({...editingStudent, grade_level: e.target.value})}>
                      <option value="">선택</option>
                      {getGradeOptions(editingStudent.school_level).map(gl => <option key={gl} value={gl}>{gl}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-indigo-600 ml-1">기준 연도</label>
                    <input className="w-full border-2 p-3.5 rounded-2xl font-black text-center text-gray-700 outline-none border-indigo-100 bg-indigo-50/20"
                      value={editingStudent.grade_year || ''} 
                      onChange={e => setEditingStudent({...editingStudent, grade_year: e.target.value})}
                      placeholder="예: 2026"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">배정 클래스</label>
                    <select className="w-full border-2 p-3.5 rounded-2xl font-black text-gray-700 outline-none" value={editingStudent.class_name || ''} onChange={e => setEditingStudent({...editingStudent, class_name: e.target.value})}>
                      <option value="">클래스 선택</option>
                      {classList.map((c, i) => <option key={i} value={c.class_name}>{c.class_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-1">입학일</label>
                    <input type="date" className="w-full border-2 p-3 rounded-2xl font-black text-orange-700 outline-none" 
                      value={editingStudent.admission_date || ''} onChange={e => setEditingStudent({...editingStudent, admission_date: e.target.value})} />
                  </div>
                </div>

                <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-indigo-600 ml-1">보호자 연락처</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl font-black bg-white text-gray-700 outline-none" value={editingStudent.parent_phone || ''} onChange={e => setEditingStudent({...editingStudent, parent_phone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-indigo-600 ml-1">관계</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl font-black bg-white text-gray-700 outline-none" value={editingStudent.parent_relation || '기타'} onChange={e => setEditingStudent({...editingStudent, parent_relation: e.target.value})}>
                        {parentRelations.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-indigo-600 ml-1">학생 연락처</label>
                      <label className="text-[10px] font-black text-indigo-600 flex items-center gap-2 cursor-pointer bg-white px-2 py-1 rounded-lg border border-indigo-100">
                        <input type="checkbox" className="accent-indigo-600" checked={editingStudent.isPhoneSame} onChange={e => setEditingStudent({...editingStudent, isPhoneSame: e.target.checked})} /> 보호자와 동일
                      </label>
                    </div>
                    <input className={`w-full border-2 p-3.5 rounded-2xl font-black outline-none ${editingStudent.isPhoneSame ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700'}`} 
                      value={editingStudent.isPhoneSame ? editingStudent.parent_phone : (editingStudent.student_phone || '')} 
                      onChange={e => !editingStudent.isPhoneSame && setEditingStudent({...editingStudent, student_phone: e.target.value})} 
                      disabled={editingStudent.isPhoneSame} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col h-full space-y-6">
                <h3 className="font-black text-xl text-gray-800 underline decoration-orange-200 decoration-8 underline-offset-4">상담 히스토리</h3>
                <div className="space-y-3 bg-orange-50/30 p-4 rounded-3xl border border-orange-100">
                  <textarea rows={2} className="w-full border-2 p-5 rounded-2xl focus:border-orange-500 outline-none font-bold resize-none bg-white" placeholder="새로운 상담 내용 입력..." value={newMemo} onChange={e => setNewMemo(e.target.value)} />
                  <button onClick={addMemo} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black shadow-lg">상담 기록 추가 📝</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 min-h-[350px] pr-2">
                  {editingStudent.memoArray.map((memo: any, idx: number) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 relative group shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full">{memo.date}</span>
                        <button onClick={() => deleteMemo(idx)} className="text-gray-300 hover:text-red-500 text-xs font-black">삭제</button>
                      </div>
                      <p className="text-base text-gray-700 leading-relaxed font-bold whitespace-pre-wrap">{memo.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 border-t bg-gray-50 flex gap-6 font-black">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 text-gray-500 hover:bg-gray-200 rounded-[1.5rem] transition-all text-lg font-black">나가기</button>
              <button onClick={handleUpdate} className="flex-[2.5] py-5 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl hover:bg-indigo-700 transition-all text-xl font-black">전체 내용 저장하기 ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}