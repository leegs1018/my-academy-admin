'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ClassPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    class_name: '',
    teacher_name: '',
    target_level: '초등',
    start_time: '14:00',
    end_time: '16:00',
    start_month: new Date().getMonth() + 1,
    tuition_fee: 0,
    // 추가: 기본 과목 설정
    test_categories: '단어, 듣기, 본시험', 
    mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);

  const dayLabels: { [key: string]: string } = {
    mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일'
  };

  const levelOptions = ['초등', '중등', '고등', '수능', '내신', '기타'];

  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
    if (data) setClasses(data);
  };

  const formatKRW = (val: number) => new Intl.NumberFormat('ko-KR').format(val) + '원';

  // --- 시간 관련 유틸리티 (기존과 동일) ---
  const parseTimeToParts = (timeStr: string) => {
    if (!timeStr) return { ampm: '오후', hour: '02', minute: '00' };
    const [h, m] = timeStr.split(':');
    const hourNum = parseInt(h);
    const ampm = hourNum >= 12 ? '오후' : '오전';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return { ampm, hour: displayHour.toString().padStart(2, '0'), minute: m };
  };

  const formatPartsToTime = (ampm: string, hour: string, minute: string) => {
    let h = parseInt(hour);
    if (ampm === '오후' && h < 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${minute}`;
  };

  const TimePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const { ampm, hour, minute } = parseTimeToParts(value);
    const update = (newAmpm: string, newHour: string, newMin: string) => {
      onChange(formatPartsToTime(newAmpm, newHour, newMin));
    };
    return (
      <div className="flex gap-1">
        <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-white text-gray-700" value={ampm} onChange={e => update(e.target.value, hour, minute)}>
          <option value="오전">오전</option><option value="오후">오후</option>
        </select>
        <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-white text-gray-700" value={hour} onChange={e => update(ampm, e.target.value, minute)}>
          {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
        </select>
        <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-white text-gray-700" value={minute} onChange={e => update(ampm, hour, e.target.value)}>
          {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m} value={m}>{m}분</option>)}
        </select>
      </div>
    );
  };

  const handleToggleDay = (day: string, isEdit: boolean = false) => {
    if (isEdit) setEditingClass({ ...editingClass, [day]: !editingClass[day] });
    else setFormData({ ...formData, [day]: !formData[day as keyof typeof formData] });
  };

  // --- 등록 로직 수정 (배열로 변환하여 저장) ---
  const addClass = async () => {
    if (!formData.class_name) return alert('클래스 명칭을 입력하세요');
    
    // 콤마로 구분된 텍스트를 배열로 변환
    const categoryArray = formData.test_categories.split(',').map(s => s.trim()).filter(s => s !== '');
    
    const { error } = await supabase.from('classes').insert([{
      ...formData,
      test_categories: categoryArray
    }]);

    if (!error) {
      alert('클래스가 성공적으로 등록되었습니다!');
      setFormData({ class_name: '', teacher_name: '', target_level: '초등', start_time: '14:00', end_time: '16:00', start_month: new Date().getMonth() + 1, tuition_fee: 0, test_categories: '단어, 듣기, 본시험', mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false });
      fetchClasses();
    }
  };

  const openEditModal = (c: any) => { 
    // DB의 배열 데이터를 다시 콤마 텍스트로 변환해서 모달에 뿌려줌
    const categoriesText = Array.isArray(c.test_categories) ? c.test_categories.join(', ') : c.test_categories;
    setEditingClass({ ...c, test_categories: categoriesText }); 
    setIsEditModalOpen(true); 
  };

  const updateClass = async () => {
    if (!editingClass.class_name) return alert('클래스 이름을 입력해주세요.');
    const { id, created_at, ...updateData } = editingClass;
    
    // 수정 시에도 텍스트를 배열로 변환
    const categoryArray = editingClass.test_categories.split(',').map((s:string) => s.trim()).filter((s:string) => s !== '');
    
    const { error } = await supabase.from('classes').update({
      ...updateData,
      test_categories: categoryArray
    }).eq('id', id);

    if (!error) { alert('클래스 정보가 수정되었습니다! ✅'); setIsEditModalOpen(false); fetchClasses(); }
  };

  const deleteClass = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) fetchClasses();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20 font-sans">
      <h1 className="text-3xl font-black text-indigo-700 border-b-4 border-indigo-100 pb-2 flex items-center gap-3">
        🏫 클래스 및 일정 관리
      </h1>

      {/* 신규 등록 섹션 */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div className="md:col-span-1">
            <label className="text-xs font-black text-gray-400 mb-2 block">반 종류</label>
            <select className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-indigo-500 bg-white" value={formData.target_level} onChange={e => setFormData({...formData, target_level: e.target.value})}>
              {levelOptions.map(opt => <option key={opt} value={opt}>{opt}반</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-black text-gray-400 mb-2 block">클래스 명칭</label>
            <input className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-indigo-500 shadow-sm" value={formData.class_name} onChange={e => setFormData({...formData, class_name: e.target.value})} placeholder="예: 중등 영문법" />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-black text-gray-400 mb-2 block">담당 선생님</label>
            <input className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-indigo-500 shadow-sm" value={formData.teacher_name} onChange={e => setFormData({...formData, teacher_name: e.target.value})} placeholder="성함" />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-black text-gray-400 mb-2 block">💰 월 수강료</label>
            <div className="relative">
              <input type="number" className="w-full border-2 p-3 rounded-xl font-black outline-none focus:border-indigo-500 shadow-sm pr-10" value={formData.tuition_fee} onChange={e => setFormData({...formData, tuition_fee: parseInt(e.target.value) || 0})} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">원</span>
            </div>
          </div>
          {/* 시험 과목 설정 필드 추가 */}
          <div className="md:col-span-1 lg:col-span-2">
            <label className="text-xs font-black text-rose-500 mb-2 block">📝 시험 과목 (콤마로 구분)</label>
            <input className="w-full border-2 p-3 rounded-xl font-bold outline-none focus:border-rose-400 shadow-sm bg-rose-50/20" value={formData.test_categories} onChange={e => setFormData({...formData, test_categories: e.target.value})} placeholder="단어, 듣기, 본시험" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
          <div>
            <label className="text-xs font-black text-gray-400 mb-2 block">수업 요일 설정</label>
            <div className="flex gap-1">
              {Object.keys(dayLabels).map(d => (
                <button key={d} onClick={() => handleToggleDay(d)} className={`flex-1 py-3 rounded-xl font-black transition-all ${formData[d as keyof typeof formData] ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{dayLabels[d]}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-black text-gray-400 mb-2 block">시작/종료 시간 및 개강월</label>
              <div className="flex gap-2">
                <TimePicker value={formData.start_time} onChange={val => setFormData({...formData, start_time: val})} />
                <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-indigo-50 text-indigo-700" value={formData.start_month} onChange={e => setFormData({...formData, start_month: parseInt(e.target.value)})}>
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월 개강</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <button onClick={addClass} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-indigo-700 shadow-xl transition-all active:scale-95">새로운 클래스 등록 완료 ✨</button>
      </div>

      {/* 클래스 목록 카드 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {classes.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-md border border-gray-100 hover:shadow-2xl transition-all flex flex-col gap-5 group relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="flex flex-wrap gap-1">
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black">{c.target_level} 반</span>
                <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black">{c.start_month}월 개강</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(c)} className="text-indigo-400 hover:text-indigo-600 font-black text-xs">수정</button>
                <button onClick={() => deleteClass(c.id)} className="text-gray-300 hover:text-red-500 font-black text-xs">삭제</button>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-800 mb-1">{c.class_name}</h3>
              <p className="text-sm font-bold text-gray-400 italic">담당: {c.teacher_name || '미지정'}</p>
            </div>

            {/* 과목 뱃지 표시 */}
            <div className="flex flex-wrap gap-1.5">
              {Array.isArray(c.test_categories) && c.test_categories.map((cat:string) => (
                <span key={cat} className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-md text-[10px] font-bold border border-rose-100">#{cat}</span>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
              <div className="font-black text-gray-700 flex items-center gap-2">
                <span className="text-indigo-500">⏰</span> 
                {parseTimeToParts(c.start_time).hour}:{parseTimeToParts(c.start_time).minute} ~ {parseTimeToParts(c.end_time).hour}:{parseTimeToParts(c.end_time).minute}
              </div>
              <div className="flex gap-1">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                  <span key={d} className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black ${c[d] ? 'bg-indigo-600 text-white' : 'bg-white text-gray-200 border border-gray-100'}`}>{dayLabels[d]}</span>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-gray-50 pt-3 mt-auto">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monthly Fee</span>
              <span className="text-lg font-black text-indigo-600">{formatKRW(c.tuition_fee)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* --- 수정 모달 (과목 수정 포함) --- */}
      {isEditModalOpen && editingClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 bg-indigo-600 text-white font-black flex justify-between items-center">
              <h2 className="text-xl italic">Edit Class Details</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-2xl">✕</button>
            </div>
            <div className="p-8 space-y-5 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase">Level</label>
                  <select className="w-full border-2 p-3 rounded-xl font-bold bg-white" value={editingClass.target_level} onChange={e => setEditingClass({...editingClass, target_level: e.target.value})}>
                    {levelOptions.map(opt => <option key={opt} value={opt}>{opt}반</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-gray-400 block mb-1 uppercase">Class Name</label>
                  <input className="w-full border-2 p-3 rounded-xl font-bold" value={editingClass.class_name} onChange={e => setEditingClass({...editingClass, class_name: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-rose-500 block mb-1 uppercase">Subjects (Comma Separated)</label>
                <input className="w-full border-2 p-3 rounded-xl font-bold bg-rose-50/10" value={editingClass.test_categories} onChange={e => setEditingClass({...editingClass, test_categories: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 block mb-1">Teacher</label>
                  <input className="w-full border-2 p-3 rounded-xl font-bold" value={editingClass.teacher_name} onChange={e => setEditingClass({...editingClass, teacher_name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-500 block mb-1 font-bold tracking-widest">TUITION</label>
                  <input type="number" className="w-full border-2 p-3 rounded-xl font-black text-indigo-600" value={editingClass.tuition_fee} onChange={e => setEditingClass({...editingClass, tuition_fee: parseInt(e.target.value) || 0})} />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                <div className="flex gap-1">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                    <button key={d} onClick={() => handleToggleDay(d, true)} className={`flex-1 py-3 rounded-xl font-black transition-all ${editingClass[d] ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}>{dayLabels[d]}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                   <TimePicker value={editingClass.start_time} onChange={val => setEditingClass({...editingClass, start_time: val})} />
                   <TimePicker value={editingClass.end_time} onChange={val => setEditingClass({...editingClass, end_time: val})} />
                </div>
              </div>
            </div>
            <div className="p-6 bg-indigo-50 flex gap-3">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 font-black text-gray-400 bg-white rounded-2xl transition-all">Cancel</button>
              <button onClick={updateClass} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all">Update Class ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}