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
    mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);

  const dayLabels: { [key: string]: string } = {
    mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일'
  };

  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
    if (data) setClasses(data);
  };

  // --- 시간 변환 유틸리티 (한글 표시용) ---
  const parseTimeToParts = (timeStr: string) => {
    if (!timeStr) return { ampm: '오후', hour: '02', minute: '00' };
    const [h, m] = timeStr.split(':');
    const hourNum = parseInt(h);
    const ampm = hourNum >= 12 ? '오후' : '오전';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return { 
      ampm, 
      hour: displayHour.toString().padStart(2, '0'), 
      minute: m 
    };
  };

  const formatPartsToTime = (ampm: string, hour: string, minute: string) => {
    let h = parseInt(hour);
    if (ampm === '오후' && h < 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${minute}`;
  };

  // --- 시간 선택 컴포넌트 ---
  const TimePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const { ampm, hour, minute } = parseTimeToParts(value);
    
    const update = (newAmpm: string, newHour: string, newMin: string) => {
      onChange(formatPartsToTime(newAmpm, newHour, newMin));
    };

    return (
      <div className="flex gap-1">
        <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-white" value={ampm} onChange={e => update(e.target.value, hour, minute)}>
          <option value="오전">오전</option><option value="오후">오후</option>
        </select>
        <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-white" value={hour} onChange={e => update(ampm, e.target.value, minute)}>
          {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
        </select>
        <select className="border-2 p-2.5 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 bg-white" value={minute} onChange={e => update(ampm, hour, e.target.value)}>
          {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <option key={m} value={m}>{m}분</option>)}
        </select>
      </div>
    );
  };

  const handleToggleDay = (day: string, isEdit: boolean = false) => {
    if (isEdit) setEditingClass({ ...editingClass, [day]: !editingClass[day] });
    else setFormData({ ...formData, [day]: !formData[day as keyof typeof formData] });
  };

  const addClass = async () => {
    if (!formData.class_name) return alert('클래스 명칭을 입력하세요');
    const { error } = await supabase.from('classes').insert([formData]);
    if (!error) {
      alert('클래스가 성공적으로 등록되었습니다!');
      setFormData({ class_name: '', teacher_name: '', target_level: '초등', start_time: '14:00', end_time: '16:00', mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false });
      fetchClasses();
    }
  };

  const openEditModal = (c: any) => { setEditingClass({ ...c }); setIsEditModalOpen(true); };

  const updateClass = async () => {
    if (!editingClass.class_name) return alert('클래스 이름을 입력해주세요.');
    const { id, created_at, ...updateData } = editingClass;
    const { error } = await supabase.from('classes').update(updateData).eq('id', id);
    if (!error) { alert('클래스 정보가 수정되었습니다! ✅'); setIsEditModalOpen(false); fetchClasses(); }
  };

  const deleteClass = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) fetchClasses();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-black text-indigo-700 border-b-4 border-indigo-100 pb-2">🏫 클래스 및 일정 관리</h1>

      {/* 신규 등록 섹션 */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-indigo-50 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="text-xs font-black text-gray-400 mb-2 block">클래스 명칭</label>
            <input className="w-full border-2 p-3 rounded-xl font-bold focus:border-indigo-500 outline-none shadow-sm" value={formData.class_name} onChange={e => setFormData({...formData, class_name: e.target.value})} placeholder="예: 중등 수학 A반" />
          </div>
          <div>
            <label className="text-xs font-black text-gray-400 mb-2 block">담당 선생님</label>
            <input className="w-full border-2 p-3 rounded-xl font-bold focus:border-indigo-500 outline-none shadow-sm" value={formData.teacher_name} onChange={e => setFormData({...formData, teacher_name: e.target.value})} placeholder="선생님 성함" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <label className="text-xs font-black text-gray-400 mb-2 block">시작 시간</label>
              <TimePicker value={formData.start_time} onChange={val => setFormData({...formData, start_time: val})} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-black text-gray-400 mb-2 block">종료 시간</label>
              <TimePicker value={formData.end_time} onChange={val => setFormData({...formData, end_time: val})} />
            </div>
          </div>
        </div>
        <button onClick={addClass} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xl hover:bg-indigo-700 shadow-xl transition-all active:scale-95">클래스 신규 등록하기 ✨</button>
      </div>

      {/* 클래스 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 hover:shadow-2xl transition-all flex flex-col gap-4 group">
            <div className="flex justify-between items-start">
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black">{c.target_level} 반</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(c)} className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md font-black text-xs hover:bg-indigo-600 hover:text-white transition-all">수정</button>
                <button onClick={() => deleteClass(c.id)} className="text-red-500 bg-red-50 px-3 py-1.5 rounded-md font-black text-xs hover:bg-red-500 hover:text-white transition-all">삭제</button>
              </div>
            </div>
            <h3 className="text-2xl font-black text-gray-800">{c.class_name}</h3>
            <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
              <div className="font-black text-indigo-600 text-lg flex items-center gap-2">
                <span className="text-xl">⏰</span> 
                {parseTimeToParts(c.start_time).ampm} {parseTimeToParts(c.start_time).hour}:{parseTimeToParts(c.start_time).minute} 
                <span className="text-gray-300 mx-1">~</span>
                {parseTimeToParts(c.end_time).ampm} {parseTimeToParts(c.end_time).hour}:{parseTimeToParts(c.end_time).minute}
              </div>
              <div className="flex gap-1">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                  <span key={d} className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black ${c[d] ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-200 border border-gray-100'}`}>{dayLabels[d]}</span>
                ))}
              </div>
            </div>
            <div className="text-sm font-bold text-gray-400 px-1 italic">담당: {c.teacher_name || '미지정'}</div>
          </div>
        ))}
      </div>

      {/* --- 수정 팝업 (모달) --- */}
      {isEditModalOpen && editingClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 bg-indigo-600 text-white font-black flex justify-between items-center">
              <h2 className="text-xl">클래스 상세 정보 수정</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-xs font-black text-gray-400 block mb-1">클래스 명칭</label>
                <input className="w-full border-2 p-3 rounded-xl font-bold focus:border-indigo-500 outline-none" value={editingClass.class_name} onChange={e => setEditingClass({...editingClass, class_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-black text-gray-400 block mb-1">수업 시작</label>
                  <TimePicker value={editingClass.start_time} onChange={val => setEditingClass({...editingClass, start_time: val})} />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 block mb-1">수업 종료</label>
                  <TimePicker value={editingClass.end_time} onChange={val => setEditingClass({...editingClass, end_time: val})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 block mb-2">수업 요일 수정</label>
                <div className="flex gap-1">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                    <button key={d} onClick={() => handleToggleDay(d, true)} className={`flex-1 py-3 rounded-xl font-black transition-all ${editingClass[d] ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-400'}`}>{dayLabels[d]}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-4">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 font-black text-gray-400 hover:bg-gray-200 rounded-2xl transition-all">취소하고 나가기</button>
              <button onClick={updateClass} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">수정 내용 저장하기 ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}