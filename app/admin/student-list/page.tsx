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

  const [userId, setUserId] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchStudents();
      fetchClasses();
    }
  }, [userId]);

  // 데이터를 가져올 때 상태 명칭을 정리하는 함수
  const cleanStatus = (status: string) => {
    if (!status) return '재원';
    // '재학', '재학중' -> '재원'으로 변경
    if (status.includes('재학')) return '재원';
    // '휴원중', '퇴원중' 등 '중'자 제거
    return status.replace('중', ''); 
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').eq('academy_id', userId).order('name', { ascending: true });
    if (data) {
      const cleanedData = data.map(s => ({
        ...s,
        status: cleanStatus(s.status)
      }));
      setStudents(cleanedData);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('class_name').eq('academy_id', userId).order('class_name', { ascending: true });
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
      <div className="flex justify-between items-center border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">학생 명부</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/student')}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-700 font-black text-sm transition-colors"
          >
            학생 등록
          </button>
          <button
            onClick={downloadExcel}
            className="flex items-center gap-1.5 bg-white text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 font-black text-sm transition-colors border border-gray-200"
          >
            엑셀 저장
          </button>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 bg-white p-4 rounded-xl border border-gray-200 font-bold text-sm">
        <input
          className="border border-gray-200 px-3 py-2.5 rounded-xl focus:outline-none focus:border-gray-400 text-gray-700 bg-white placeholder:text-gray-300 font-medium"
          placeholder="이름 / 연락처 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="border border-gray-200 px-3 py-2.5 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-gray-400"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">모든 상태</option>
          <option value="재원">재원</option>
          <option value="휴원">휴원</option>
          <option value="퇴원">퇴원</option>
        </select>
        <select
          className="border border-gray-200 px-3 py-2.5 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-gray-400"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="">모든 클래스</option>
          {classList.map((c, i) => <option key={i} value={c.class_name}>{c.class_name}</option>)}
        </select>
        <select
          className="border border-gray-200 px-3 py-2.5 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-gray-400"
          value={filterSchool}
          onChange={(e) => setFilterSchool(e.target.value)}
        >
          <option value="">모든 학교</option>
          {schoolList.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
        </select>
        <select
          className="border border-gray-200 px-3 py-2.5 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-gray-400"
          value={filterSchoolLevel}
          onChange={(e) => { setFilterSchoolLevel(e.target.value); setFilterGradeLevel(''); }}
        >
          <option value="">학교 구분 전체</option>
          {existingSchoolLevels.map(sl => <option key={sl} value={sl as string}>{sl as string}</option>)}
        </select>
        <select
          className="border border-gray-200 px-3 py-2.5 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-gray-400"
          value={filterGradeLevel}
          onChange={(e) => setFilterGradeLevel(e.target.value)}
        >
          <option value="">학년 전체</option>
          {filterSchoolLevel && getGradeOptions(filterSchoolLevel).map(gl => <option key={gl} value={gl}>{gl}</option>)}
        </select>
        <button
          onClick={() => {
            setSearchTerm('');
            setFilterStatus('');
            setFilterClass('');
            setFilterSchool('');
            setFilterSchoolLevel('');
            setFilterGradeLevel('');
          }}
          className="border border-gray-200 px-3 py-2.5 rounded-xl bg-white text-gray-500 hover:bg-gray-50 font-black text-sm transition-colors"
        >
          초기화
        </button>
      </div>

      {/* 명단 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-black text-xs text-center uppercase tracking-wider">
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
              <tr key={s.id} className="hover:bg-gray-50 transition-all font-medium">
                <td className="p-5 text-left">
                  <span onClick={() => openEditModal(s)} className="font-black text-gray-900 text-lg cursor-pointer hover:underline underline-offset-4 decoration-2">{s.name}</span>
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
                  <div className="text-[11px] text-gray-400 font-bold">{s.school_level} {s.grade_level}</div>
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
  onClick={() => router.push(`/admin/report?studentId=${s.id}`)} 
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-gray-900">{editingStudent.name} 학생 정보 수정</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">변경 후 하단 저장 버튼을 눌러주세요</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">

                {/* 왼쪽: 학생 정보 */}
                <div className="space-y-5">

                  {/* 상태 */}
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">상태</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">재원 상태</label>
                        <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.status} onChange={e => setEditingStudent({...editingStudent, status: e.target.value})}>
                          <option value="재원">재원</option>
                          <option value="휴원">휴원</option>
                          <option value="퇴원">퇴원</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">비고</label>
                        <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.caution_level} onChange={e => setEditingStudent({...editingStudent, caution_level: Number(e.target.value)})}>
                          <option value={0}>🥚</option>
                          <option value={1}>🐤</option>
                          <option value={2}>🐤🐤</option>
                          <option value={3}>🐤🐤🐤</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 기본 정보 */}
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">기본 정보</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">이름</label>
                        <input className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">성별</label>
                        <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.gender} onChange={e => setEditingStudent({...editingStudent, gender: e.target.value})}>
                          <option value="남">남</option><option value="여">여</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">생년월일</label>
                        <input type="date" className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.birth_date || ''} onChange={e => setEditingStudent({...editingStudent, birth_date: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* 학교 정보 */}
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">학교 정보</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">학교 구분</label>
                        <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.school_level || ''}
                          onChange={e => setEditingStudent({...editingStudent, school_level: e.target.value, grade_level: getGradeOptions(e.target.value)[0] || ''})}>
                          <option value="">선택</option>
                          {schoolLevels.map(sl => <option key={sl} value={sl}>{sl}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">학교명</label>
                        <input className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.school_name || ''} onChange={e => setEditingStudent({...editingStudent, school_name: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">학년</label>
                        <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.grade_level || ''} onChange={e => setEditingStudent({...editingStudent, grade_level: e.target.value})}>
                          <option value="">선택</option>
                          {getGradeOptions(editingStudent.school_level).map(gl => <option key={gl} value={gl}>{gl}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 수강 정보 */}
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">수강 정보</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">기준 연도</label>
                        <input className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm text-center"
                          value={editingStudent.grade_year || ''}
                          onChange={e => setEditingStudent({...editingStudent, grade_year: e.target.value})}
                          placeholder="예: 2026" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">배정 클래스</label>
                        <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.class_name || ''} onChange={e => setEditingStudent({...editingStudent, class_name: e.target.value})}>
                          <option value="">클래스 선택</option>
                          {classList.map((c, i) => <option key={i} value={c.class_name}>{c.class_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">입학일</label>
                        <input type="date" className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm"
                          value={editingStudent.admission_date || ''} onChange={e => setEditingStudent({...editingStudent, admission_date: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* 연락처 */}
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">연락처</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-500">보호자 연락처</label>
                          <input className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm"
                            value={editingStudent.parent_phone || ''} onChange={e => setEditingStudent({...editingStudent, parent_phone: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-500">관계</label>
                          <select className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 bg-white focus:outline-none focus:border-gray-400 text-sm"
                            value={editingStudent.parent_relation || '기타'} onChange={e => setEditingStudent({...editingStudent, parent_relation: e.target.value})}>
                            {parentRelations.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-gray-500">학생 연락처</label>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 cursor-pointer">
                            <input type="checkbox" className="accent-gray-600 w-3.5 h-3.5" checked={editingStudent.isPhoneSame}
                              onChange={e => setEditingStudent({...editingStudent, isPhoneSame: e.target.checked})} />
                            보호자와 동일
                          </label>
                        </div>
                        <input className={`w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold focus:outline-none focus:border-gray-400 text-sm transition-colors ${editingStudent.isPhoneSame ? 'bg-gray-50 text-gray-400' : 'bg-white text-gray-800'}`}
                          value={editingStudent.isPhoneSame ? editingStudent.parent_phone : (editingStudent.student_phone || '')}
                          onChange={e => !editingStudent.isPhoneSame && setEditingStudent({...editingStudent, student_phone: e.target.value})}
                          disabled={editingStudent.isPhoneSame} />
                      </div>
                    </div>
                  </div>

                </div>

                {/* 오른쪽: 상담 히스토리 */}
                <div className="flex flex-col space-y-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">상담 히스토리</p>

                  <div className="space-y-2">
                    <textarea rows={3} className="w-full border border-gray-200 px-3 py-2.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-gray-400 text-sm resize-none placeholder:text-gray-300"
                      placeholder="새로운 상담 내용을 입력하세요..." value={newMemo} onChange={e => setNewMemo(e.target.value)} />
                    <button onClick={addMemo} className="w-full bg-gray-900 hover:bg-gray-700 text-white py-2.5 rounded-xl font-black text-sm transition-colors">
                      상담 기록 추가
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px] pr-1">
                    {editingStudent.memoArray.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-sm text-gray-300 font-bold">상담 기록이 없습니다</div>
                    )}
                    {editingStudent.memoArray.map((memo: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-black text-gray-500">{memo.date}</span>
                          <button onClick={() => deleteMemo(idx)} className="text-xs font-bold text-gray-300 hover:text-red-400 transition-colors">삭제</button>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">{memo.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-sm font-black text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">취소</button>
              <button onClick={handleUpdate} className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl font-black text-sm transition-colors">저장</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}