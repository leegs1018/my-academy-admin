'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Subject {
  id: string;
  name: string;
  description: string;
}

export default function ClassPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // 새 과목 생성 시 고유 ID 부여 (이 ID는 평생 갑니다)
  const createInitialSubject = (): Subject => ({
    id: crypto.randomUUID(), 
    name: '',
    description: ''
  });

  const [formData, setFormData] = useState({
    class_name: '',
    teacher_name: '',
    target_level: '초등',
    start_time: '14:00',
    end_time: '16:00',
    start_year: currentYear,
    tuition_fee: 0,
    test_categories: [createInitialSubject()], 
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
  const formatDisplayTime = (timeStr: string) => timeStr ? timeStr.slice(0, 5) : '';

  const addSubjectField = (isEdit: boolean = false) => {
    const newSub = createInitialSubject();
    if (isEdit) {
      setEditingClass({ ...editingClass, test_categories: [...(editingClass.test_categories || []), newSub] });
    } else {
      setFormData({ ...formData, test_categories: [...formData.test_categories, newSub] });
    }
  };

  const removeSubjectField = (index: number, isEdit: boolean = false) => {
    if (confirm('과목을 삭제하면 해당 과목의 기존 성적 데이터가 리포트에서 제외됩니다. 계속하시겠습니까?')) {
      if (isEdit) {
        const updated = editingClass.test_categories.filter((_: any, i: number) => i !== index);
        setEditingClass({ ...editingClass, test_categories: updated });
      } else {
        const updated = formData.test_categories.filter((_, i) => i !== index);
        setFormData({ ...formData, test_categories: updated });
      }
    }
  };

  const handleSubjectChange = (index: number, field: keyof Subject, value: string, isEdit: boolean = false) => {
    if (isEdit) {
      const updated = [...editingClass.test_categories];
      updated[index] = { ...updated[index], [field]: value };
      setEditingClass({ ...editingClass, test_categories: updated });
    } else {
      const updated = [...formData.test_categories];
      updated[index] = { ...updated[index], [field]: value };
      setFormData({ ...formData, test_categories: updated });
    }
  };

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

  const TimePicker = ({ value, onChange, label }: { value: string, onChange: (val: string) => void, label?: string }) => {
    const { ampm, hour, minute } = parseTimeToParts(value);
    const update = (newAmpm: string, newHour: string, newMin: string) => {
      onChange(formatPartsToTime(newAmpm, newHour, newMin));
    };
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-[11px] font-black text-indigo-400 ml-1 uppercase">{label}</span>}
        <div className="flex gap-1">
          <select className="border-2 p-3 rounded-2xl font-bold text-sm bg-white" value={ampm} onChange={e => update(e.target.value, hour, minute)}>
            <option value="오전">오전</option><option value="오후">오후</option>
          </select>
          <select className="border-2 p-3 rounded-2xl font-bold text-sm bg-white" value={hour} onChange={e => update(ampm, e.target.value, minute)}>
            {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
          <select className="border-2 p-3 rounded-2xl font-bold text-sm bg-white" value={minute} onChange={e => update(ampm, hour, e.target.value)}>
            {['00','10','20','30','40','50'].map(m => <option key={m} value={m}>{m}분</option>)}
          </select>
        </div>
      </div>
    );
  };

  const handleToggleDay = (day: string, isEdit: boolean = false) => {
    if (isEdit) setEditingClass({ ...editingClass, [day]: !editingClass[day] });
    else setFormData({ ...formData, [day]: !formData[day as keyof typeof formData] });
  };

  const addClass = async () => {
    if (!formData.class_name) return alert('클래스 명칭을 입력하세요');
    const validCategories = formData.test_categories.filter(cat => cat.name.trim() !== '');
    if (validCategories.length === 0) return alert('최소 하나 이상의 과목을 입력하세요.');

    const { error } = await supabase.from('classes').insert([{ ...formData, test_categories: validCategories }]);
    if (!error) {
      alert('클래스 등록 성공!');
      setFormData({ 
        class_name: '', teacher_name: '', target_level: '초등', start_time: '14:00', end_time: '16:00', 
        start_year: currentYear, tuition_fee: 0, test_categories: [createInitialSubject()], 
        mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false 
      });
      fetchClasses();
    }
  };

  const openEditModal = (c: any) => { 
    const categories = Array.isArray(c.test_categories) ? c.test_categories : [];
    setEditingClass({ ...c, test_categories: categories.length > 0 ? categories : [createInitialSubject()] }); 
    setIsEditModalOpen(true); 
  };

  const updateClass = async () => {
    const { id, created_at, ...rest } = editingClass;
    const validCategories = editingClass.test_categories.filter((cat: any) => cat.name.trim() !== '');
    
    const { error } = await supabase.from('classes').update({ ...rest, test_categories: validCategories }).eq('id', id);
    if (!error) { alert('수정 완료! ✅'); setIsEditModalOpen(false); fetchClasses(); }
  };

  const deleteClass = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('classes').delete().eq('id', id);
    fetchClasses();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20 font-sans text-slate-800">
      <h1 className="text-3xl font-black text-indigo-700 border-b-4 border-indigo-100 pb-2 tracking-tighter uppercase">🏫 Class Manager</h1>

      {/* 등록 섹션 */}
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-indigo-50 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><label className="text-xs font-black text-gray-400 mb-2 block uppercase">Level</label>
            <select className="w-full border-2 p-3.5 rounded-2xl font-bold bg-white outline-none focus:border-indigo-500" value={formData.target_level} onChange={e => setFormData({...formData, target_level: e.target.value})}>
              {levelOptions.map(opt => <option key={opt} value={opt}>{opt}반</option>)}
            </select>
          </div>
          <div><label className="text-xs font-black text-gray-400 mb-2 block uppercase">Class Name</label>
            <input className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-indigo-500" value={formData.class_name} onChange={e => setFormData({...formData, class_name: e.target.value})} placeholder="클래스명" />
          </div>
          <div><label className="text-xs font-black text-gray-400 mb-2 block uppercase">Teacher</label>
            <input className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-indigo-500" value={formData.teacher_name} onChange={e => setFormData({...formData, teacher_name: e.target.value})} placeholder="강사명" />
          </div>
          <div><label className="text-xs font-black text-gray-400 mb-2 block uppercase">Tuition</label>
            <input type="number" className="w-full border-2 p-3.5 rounded-2xl font-black text-indigo-600 outline-none" value={formData.tuition_fee} onChange={e => setFormData({...formData, tuition_fee: parseInt(e.target.value) || 0})} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-black text-rose-500 block uppercase tracking-widest">📝 Subjects (Auto-ID Sync)</label>
            <button onClick={() => addSubjectField(false)} className="bg-rose-500 text-white w-8 h-8 rounded-full font-black hover:bg-rose-600 shadow-md">+</button>
          </div>
          <div className="space-y-3">
            {formData.test_categories.map((cat, index) => (
              <div key={cat.id} className="flex gap-3 items-start animate-in slide-in-from-left-2">
                <div className="flex-[1]">
                  <input className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-rose-400 bg-rose-50/10" value={cat.name} onChange={e => handleSubjectChange(index, 'name', e.target.value, false)} placeholder="과목명" />
                  <p className="text-[8px] text-gray-300 mt-1 ml-2 font-mono">FIXED ID: {cat.id.split('-')[0]}...</p>
                </div>
                <div className="flex-[2]">
                  <input className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-rose-400 bg-rose-50/10" value={cat.description} onChange={e => handleSubjectChange(index, 'description', e.target.value, false)} placeholder="설명" />
                </div>
                {formData.test_categories.length > 1 && (
                  <button onClick={() => removeSubjectField(index, false)} className="p-3.5 text-rose-300">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-3">
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase">Opening Year</label>
            <select className="w-full border-2 p-3.5 rounded-2xl font-black text-sm outline-none focus:border-indigo-500 bg-indigo-50 text-indigo-700" value={formData.start_year} onChange={e => setFormData({...formData, start_year: parseInt(e.target.value)})}>
              {yearOptions.map(y => <option key={y} value={y}>{y}년도</option>)}
            </select>
          </div>
          <div className="lg:col-span-9">
            <div className="flex gap-1.5">
              {Object.keys(dayLabels).map(d => (
                <button key={d} onClick={() => handleToggleDay(d)} className={`flex-1 py-4 rounded-2xl font-black transition-all ${formData[d as keyof typeof formData] ? 'bg-indigo-600 text-white shadow-lg -translate-y-1' : 'bg-gray-100 text-gray-300'}`}>{dayLabels[d]}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-8 items-center bg-slate-50 p-6 rounded-[2rem]">
          <TimePicker label="시작 시간" value={formData.start_time} onChange={val => setFormData({...formData, start_time: val})} />
          <TimePicker label="종료 시간" value={formData.end_time} onChange={val => setFormData({...formData, end_time: val})} />
        </div>

        <button onClick={addClass} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-indigo-700 shadow-2xl transition-all">클래스 등록 ✨</button>
      </div>

      {/* 리스트 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        {classes.map((c) => (
          <div key={c.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-2">
                <span className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-[12px] font-black">{c.target_level} 반</span>
                <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-[12px] font-black">{c.start_year}년</span>
              </div>
              <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(c)} className="text-indigo-500 font-black text-xs">수정</button>
                <button onClick={() => deleteClass(c.id)} className="text-rose-300 font-black text-xs">삭제</button>
              </div>
            </div>

            <div className="flex justify-between items-end border-b pb-4 mb-4">
              <div><h3 className="text-2xl font-black text-slate-800 tracking-tight">{c.class_name}</h3><p className="text-sm font-bold text-slate-400">Teacher. {c.teacher_name || '미지정'}</p></div>
              <span className="text-2xl font-black text-indigo-600 italic">{formatKRW(c.tuition_fee)}</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {Array.isArray(c.test_categories) && c.test_categories.map((cat: Subject) => (
                <span key={cat.id} className="px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[11px] font-black border border-rose-100" title={cat.id}>#{cat.name}</span>
              ))}
            </div>

            <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-4">
              <div className="flex gap-1.5">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                  <span key={d} className={`flex-1 h-10 flex items-center justify-center rounded-2xl text-xs font-black ${c[d] ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-200 border border-slate-50'}`}>{dayLabels[d]}</span>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3 font-black text-indigo-700 text-lg">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Schedule</span>
                <div>{formatDisplayTime(c.start_time)} ~ {formatDisplayTime(c.end_time)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 수정 모달 */}
      {isEditModalOpen && editingClass && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border-4 border-indigo-600 animate-in zoom-in-95">
            <div className="p-8 bg-indigo-600 text-white font-black flex justify-between items-center">
              <h2 className="text-2xl italic uppercase tracking-tighter">Edit Class</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-3xl">✕</button>
            </div>
            <div className="p-10 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-400 ml-1">CLASS NAME</label>
                  <input className="w-full border-2 p-4 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={editingClass.class_name} onChange={e => setEditingClass({...editingClass, class_name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-400 ml-1">TEACHER</label>
                  <input className="w-full border-2 p-4 rounded-2xl font-bold focus:border-indigo-500 outline-none" value={editingClass.teacher_name} onChange={e => setEditingClass({...editingClass, teacher_name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-400 ml-1">TARGET LEVEL</label>
                  <select className="w-full border-2 p-4 rounded-2xl font-bold bg-white" value={editingClass.target_level} onChange={e => setEditingClass({...editingClass, target_level: e.target.value})}>
                    {levelOptions.map(opt => <option key={opt} value={opt}>{opt}반</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-400 ml-1">TUITION FEE</label>
                  <input type="number" className="w-full border-2 p-4 rounded-2xl font-black text-indigo-600 outline-none" value={editingClass.tuition_fee} onChange={e => setEditingClass({...editingClass, tuition_fee: parseInt(e.target.value) || 0})} />
                </div>
              </div>

              <div className="space-y-3 p-6 bg-rose-50/20 rounded-[2rem] border border-rose-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-rose-500 uppercase">Subjects</span>
                  <button onClick={() => addSubjectField(true)} className="bg-rose-500 text-white w-7 h-7 rounded-full text-xs shadow-md">+</button>
                </div>
                {editingClass.test_categories.map((cat: any, index: number) => (
                  <div key={cat.id} className="flex gap-2 items-start bg-white p-3 rounded-2xl border border-rose-50 shadow-sm">
                    <div className="flex-1">
                      <input className="w-full border-b-2 p-2 font-bold text-sm outline-none focus:border-rose-300" value={cat.name} onChange={e => handleSubjectChange(index, 'name', e.target.value, true)} placeholder="과목명" />
                      <p className="text-[7px] text-gray-300 mt-1 ml-1 font-mono">UUID: {cat.id}</p>
                    </div>
                    <input className="flex-[2] border-b-2 p-2 font-bold text-sm outline-none focus:border-rose-300" value={cat.description} onChange={e => handleSubjectChange(index, 'description', e.target.value, true)} placeholder="설명" />
                    <button onClick={() => removeSubjectField(index, true)} className="text-rose-200 p-2">✕</button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-indigo-400 ml-1 uppercase font-black">Days</label>
                <div className="flex gap-1">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                    <button key={d} onClick={() => handleToggleDay(d, true)} className={`flex-1 py-3 rounded-xl font-black transition-all ${editingClass[d] ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 text-slate-300'}`}>{dayLabels[d]}</button>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-[2.5rem] flex gap-4 justify-center items-center">
                <TimePicker label="시작" value={editingClass.start_time} onChange={val => setEditingClass({...editingClass, start_time: val})} />
                <div className="text-indigo-200 font-black text-2xl hidden md:block pt-4">→</div>
                <TimePicker label="종료" value={editingClass.end_time} onChange={val => setEditingClass({...editingClass, end_time: val})} />
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-4">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 bg-white rounded-2xl">취소</button>
              <button onClick={updateClass} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700">업데이트 완료 ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}