'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentListPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSchool, setFilterSchool] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [newMemo, setNewMemo] = useState(''); 

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name', { ascending: true });
    if (data) setStudents(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('class_name').order('class_name');
    if (data) setClassList(data);
  };

  const schoolList = Array.from(new Set(students.map(s => s.school_name).filter(Boolean)));

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.includes(searchTerm) || 
                         (s.student_phone && s.student_phone.includes(searchTerm)) ||
                         (s.parent_phone && s.parent_phone.includes(searchTerm));
    const matchesClass = filterClass === '' || s.class_name === filterClass;
    const matchesSchool = filterSchool === '' || s.school_name === filterSchool;
    return matchesSearch && matchesClass && matchesSchool;
  });

 const deleteStudent = async (id: string, name: string) => { // id 타입을 string으로 변경
  if (!confirm(`${name} 학생의 모든 기록이 삭제됩니다. 정말 삭제하시겠습니까?`)) return;
  
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id); // 숫자로 변환하지 않고 문자열 그대로 비교

  if (error) {
    console.error("삭제 에러:", error.message);
    alert(`삭제 실패: ${error.message}`);
  } else {
    alert(`${name} 학생이 삭제되었습니다.`);
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
    
    setEditingStudent({ ...student, memoArray, isPhoneSame: student.student_phone === student.parent_phone });
    setNewMemo('');
    setIsEditModalOpen(true);
  };

  // 상담 메모 추가 (버튼 클릭 시에만 동작하도록 엔터 핸들러 제거)
  const addMemo = () => {
    if (!newMemo.trim()) return;
    const today = new Date().toLocaleDateString();
    const updatedMemos = [{ date: today, content: newMemo }, ...editingStudent.memoArray];
    setEditingStudent({ ...editingStudent, memoArray: updatedMemos });
    setNewMemo('');
  };

  // 상담 메모 삭제 로직 추가
  const deleteMemo = (index: number) => {
    if (!confirm('이 상담 기록을 삭제하시겠습니까?')) return;
    const updatedMemos = [...editingStudent.memoArray];
    updatedMemos.splice(index, 1);
    setEditingStudent({ ...editingStudent, memoArray: updatedMemos });
  };

  const handleUpdate = async () => {
    const { isPhoneSame, memoArray, ...updateData } = editingStudent;
    const finalData = {
      ...updateData,
      student_phone: isPhoneSame ? editingStudent.parent_phone : editingStudent.student_phone,
      counseling_memo: JSON.stringify(memoArray)
    };

    const { error } = await supabase
      .from('students')
      .update(finalData)
      .eq('id', editingStudent.id);

    if (!error) {
      alert('성공적으로 수정되었습니다.');
      setIsEditModalOpen(false);
      fetchStudents();
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 pb-20">
      {/* ... 명부 헤더 및 필터 (기존 코드 유지) ... */}
      <div className="flex justify-between items-center border-b-4 border-indigo-100 pb-6">
        <h1 className="text-3xl font-black text-indigo-700">📋 학생 통합 명부</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-5 rounded-2xl shadow-md border border-gray-100 font-bold">
        <input className="border-2 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="이름/연락처 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <select className="border-2 p-3 rounded-xl bg-gray-50 text-gray-700" value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
          <option value="">🏫 모든 학교</option>
          {schoolList.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
        </select>
        <select className="border-2 p-3 rounded-xl bg-gray-50 text-gray-700" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">📖 모든 클래스</option>
          {classList.map((c, i) => <option key={i} value={c.class_name}>{c.class_name}</option>)}
        </select>
        <button onClick={() => {setSearchTerm(''); setFilterClass(''); setFilterSchool('');}} className="bg-gray-800 text-white py-3 rounded-xl hover:bg-black transition-all">초기화</button>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl border overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-gray-50 text-indigo-900 border-b-2 border-indigo-50 font-black text-sm">
            <tr>
              <th className="p-5">이름</th>
              <th className="p-5">학교 / 학년</th>
              <th className="p-5">수강 클래스</th>
              <th className="p-5">학생 연락처</th>
              <th className="p-5">보호자 연락처</th>
              <th className="p-5 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="hover:bg-indigo-50/30 transition-all font-medium">
                <td className="p-5">
                  <button onClick={() => openEditModal(s)} className="font-black text-lg text-indigo-600 hover:underline">{s.name}</button>
                  <div className="text-[10px] text-gray-400 font-bold">{s.gender}</div>
                </td>
                <td className="p-5">
                  <div className="font-bold text-gray-700">{s.school_name || '-'}</div>
                  <div className="text-xs text-indigo-400 font-bold">{s.school_level} {s.grade_level}</div>
                </td>
                <td className="p-5">
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-black">{s.class_name || '미배정'}</span>
                </td>
                <td className="p-5 font-mono font-bold text-gray-600">{s.student_phone || '-'}</td>
                <td className="p-5">
                  <div className="font-mono font-bold text-gray-800">{s.parent_phone || '-'}</div>
                  <div className="text-[10px] text-gray-400 font-black">{s.parent_relation}</div>
                </td>
                <td className="p-5 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => openEditModal(s)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-black border border-indigo-100">수정</button>
                    <button onClick={() => deleteStudent(s.id, s.name)} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-black border border-red-100">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- 수정 및 상담 기록 팝업 (강화 버전) --- */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white font-black">
              <h2 className="text-xl">학생 정보 및 상담 히스토리 관리</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* 왼쪽: 정보 수정 */}
              <div className="space-y-6 pr-0 lg:pr-4 border-r-0 lg:border-r border-gray-100">
                <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                  <span className="bg-indigo-600 w-1.5 h-6 rounded-full inline-block"></span>
                  인적사항 수정
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase">이름</label>
                    <input className="w-full border-2 p-2.5 rounded-xl font-bold focus:border-indigo-500 outline-none" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase">성별</label>
                    <select className="w-full border-2 p-2.5 rounded-xl font-bold outline-none" value={editingStudent.gender} onChange={e => setEditingStudent({...editingStudent, gender: e.target.value})}><option value="남">남</option><option value="여">여</option></select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">학교명</label>
                  <input className="w-full border-2 p-2.5 rounded-xl font-bold focus:border-indigo-500 outline-none" value={editingStudent.school_name} onChange={e => setEditingStudent({...editingStudent, school_name: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">배정 클래스</label>
                  <select className="w-full border-2 p-2.5 rounded-xl font-bold outline-none" value={editingStudent.class_name} onChange={e => setEditingStudent({...editingStudent, class_name: e.target.value})}>
                    <option value="">클래스 선택</option>
                    {classList.map((c, i) => <option key={i} value={c.class_name}>{c.class_name}</option>)}
                  </select>
                </div>
                
                <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4 shadow-inner">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-indigo-600 uppercase">보호자 연락처</label>
                    <input className="w-full border-2 p-2.5 rounded-xl font-bold border-indigo-100 focus:border-indigo-500 outline-none bg-white" value={editingStudent.parent_phone} onChange={e => setEditingStudent({...editingStudent, parent_phone: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-indigo-600 uppercase">학생 연락처</label>
                      <label className="text-[11px] font-black text-indigo-600 flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded-lg shadow-sm border border-indigo-100">
                        <input type="checkbox" className="accent-indigo-600" checked={editingStudent.isPhoneSame} onChange={e => setEditingStudent({...editingStudent, isPhoneSame: e.target.checked})} /> 보호자와 동일
                      </label>
                    </div>
                    <input className={`w-full border-2 p-2.5 rounded-xl font-bold outline-none ${editingStudent.isPhoneSame ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white border-indigo-100 focus:border-indigo-500'}`} 
                      value={editingStudent.isPhoneSame ? editingStudent.parent_phone : (editingStudent.student_phone || '')} 
                      onChange={e => !editingStudent.isPhoneSame && setEditingStudent({...editingStudent, student_phone: e.target.value})} 
                      disabled={editingStudent.isPhoneSame} />
                  </div>
                </div>
              </div>

              {/* 오른쪽: 상담 히스토리 강화 */}
              <div className="flex flex-col h-full space-y-6">
                <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                  <span className="bg-orange-500 w-1.5 h-6 rounded-full inline-block"></span>
                  상담 히스토리
                </h3>
                
                {/* 입력창 (2줄 높이 텍스트영역) */}
                <div className="space-y-3">
                  <textarea 
                    rows={2}
                    className="w-full border-2 p-4 rounded-2xl focus:border-orange-500 outline-none shadow-sm font-medium resize-none bg-orange-50/20" 
                    placeholder="새로운 상담 내용을 상세히 입력하세요... (엔터로 줄바꿈 가능)" 
                    value={newMemo} 
                    onChange={e => setNewMemo(e.target.value)}
                  />
                  <button onClick={addMemo} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-black shadow-md transition-all active:scale-[0.98]">
                    상담 내용 추가 📝
                  </button>
                </div>

                {/* 상담 리스트 (삭제 버튼 추가) */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-3 min-h-[300px]">
                  {editingStudent.memoArray.length > 0 ? (
                    editingStudent.memoArray.map((memo: any, idx: number) => (
                      <div key={idx} className="bg-white p-5 rounded-2xl border-2 border-orange-50 relative group hover:border-orange-200 transition-all shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-black text-orange-500 bg-orange-50 px-2 py-1 rounded">{memo.date}</span>
                          <button 
                            onClick={() => deleteMemo(idx)}
                            className="text-gray-300 hover:text-red-500 text-xs font-bold transition-colors p-1"
                          >
                            삭제
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed font-bold whitespace-pre-wrap">{memo.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-2 py-20">
                      <span className="text-4xl">📄</span>
                      <p className="italic font-bold">등록된 상담 기록이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-4 font-black">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 text-gray-500 hover:bg-gray-200 rounded-2xl transition-all">나가기</button>
              <button onClick={handleUpdate} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-[0.98]">전체 내용 저장하기 ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}