'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

// 과목 타입 정의
interface Subject {
  name: string;
  description: string;
}

export default function ClassPage() {
  const [classes, setClasses] = useState<any[]>([]);
  
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // formData의 test_categories를 배열 객체로 변경
  const [formData, setFormData] = useState({
    class_name: '',
    teacher_name: '',
    target_level: '초등',
    start_time: '14:00',
    end_time: '16:00',
    start_year: currentYear,
    tuition_fee: 0,
    test_categories: [{ name: '', description: '' }] as Subject[], 
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

  // --- 과목 추가/삭제/수정 로직 ---
  const addSubjectField = (isEdit: boolean = false) => {
    if (isEdit) {
      setEditingClass({
        ...editingClass,
        test_categories: [...editingClass.test_categories, { name: '', description: '' }]
      });
    } else {
      setFormData({
        ...formData,
        test_categories: [...formData.test_categories, { name: '', description: '' }]
      });
    }
  };

  const removeSubjectField = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      const updated = editingClass.test_categories.filter((_: any, i: number) => i !== index);
      setEditingClass({ ...editingClass, test_categories: updated });
    } else {
      const updated = formData.test_categories.filter((_, i) => i !== index);
      setFormData({ ...formData, test_categories: updated });
    }
  };

  const handleSubjectChange = (index: number, field: keyof Subject, value: string, isEdit: boolean = false) => {
    if (isEdit) {
      const updated = [...editingClass.test_categories];
      updated[index][field] = value;
      setEditingClass({ ...editingClass, test_categories: updated });
    } else {
      const updated = [...formData.test_categories];
      updated[index][field] = value;
      setFormData({ ...formData, test_categories: updated });
    }
  };
  // ----------------------------

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
        {label && <span className="text-[11px] font-black text-indigo-400 ml-1">{label}</span>}
        <div className="flex gap-1">
          <select className="border-2 p-3 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 bg-white" value={ampm} onChange={e => update(e.target.value, hour, minute)}>
            <option value="오전">오전</option><option value="오후">오후</option>
          </select>
          <select className="border-2 p-3 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 bg-white" value={hour} onChange={e => update(ampm, e.target.value, minute)}>
            {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
          <select className="border-2 p-3 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 bg-white" value={minute} onChange={e => update(ampm, hour, e.target.value)}>
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
  
  // 1. 유효한 과목만 추출
  const validSubjects = formData.test_categories.filter(cat => cat.name.trim() !== '');

  // 2. 이름 배열과 설명 배열로 각각 분리
  const nameArray = validSubjects.map(s => s.name);
  const descArray = validSubjects.map(s => s.description);

  const { error } = await supabase.from('classes').insert([{
    class_name: formData.class_name,
    teacher_name: formData.teacher_name,
    target_level: formData.target_level,
    start_time: formData.start_time,
    end_time: formData.end_time,
    start_year: formData.start_year,
    tuition_fee: formData.tuition_fee,
    mon: formData.mon, tue: formData.tue, wed: formData.wed, 
    thu: formData.thu, fri: formData.fri, sat: formData.sat, sun: formData.sun,
    // 분리해서 저장!
    test_categories: nameArray,
    category_descriptions: descArray 
  }]);

  if (!error) {
    alert('클래스가 성공적으로 등록되었습니다!');
    // ... 초기화 로직
    fetchClasses();
  }
};

const openEditModal = (c: any) => { 
  // 1. 데이터가 배열인지 확실히 체크하고 타입 정의
  const names: string[] = Array.isArray(c.test_categories) ? c.test_categories : [];
  const descs: string[] = Array.isArray(c.category_descriptions) ? c.category_descriptions : [];
  
  // 2. map 함수에 타입 명시 (name: string, i: number)
  const mergedCategories = names.map((name: string, i: number) => {
    let cleanName = name;
    let cleanDesc = descs[i] || '';

    // 만약 데이터가 혹시라도 객체 문자열 형태로 저장되어 있다면 파싱
    if (typeof name === 'string' && name.startsWith('{')) {
      try {
        const parsed = JSON.parse(name);
        cleanName = parsed.name || '';
        cleanDesc = parsed.description || '';
      } catch (e) {
        cleanName = name;
      }
    }

    return { name: cleanName, description: cleanDesc };
  });

  const finalCategories = mergedCategories.length > 0 ? mergedCategories : [{ name: '', description: '' }];

  setEditingClass({ 
    ...c, 
    test_categories: finalCategories, 
    start_year: c.start_year || currentYear 
  }); 
  setIsEditModalOpen(true); 
};

 const updateClass = async () => {
  if (!editingClass.class_name) return alert('클래스 이름을 입력해주세요.');
  
  const { id, created_at, ...rest } = editingClass;

  // 1. 유효한 과목만 필터링
  const validSubjects = editingClass.test_categories.filter((cat: any) => cat.name.trim() !== '');

  // 2. DB 컬럼 규격에 맞게 이름 배열과 설명 배열로 분리
  const nameArray = validSubjects.map((s: any) => s.name);
  const descArray = validSubjects.map((s: any) => s.description);

  // 3. 업데이트 요청
  const { error } = await supabase.from('classes').update({
    ...rest,
    test_categories: nameArray,           // 문자열 배열로 전달
    category_descriptions: descArray      // 문자열 배열로 전달
  }).eq('id', id);

  if (!error) { 
    alert('클래스 정보가 수정되었습니다! ✅'); 
    setIsEditModalOpen(false); 
    fetchClasses(); 
  } else {
    console.error("Update Error:", error);
    alert('수정 중 오류가 발생했습니다.');
  }
};

  const deleteClass = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) fetchClasses();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20 font-sans text-slate-800">
      <h1 className="text-3xl font-black text-indigo-700 border-b-4 border-indigo-100 pb-2 flex items-center gap-3 italic tracking-tighter">
        🏫 CLASS MANAGER
      </h1>

      {/* --- 신규 등록 섹션 --- */}
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-indigo-50 space-y-8">
        
        {/* 행 1: 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase">Level</label>
            <select className="w-full border-2 p-3.5 rounded-2xl font-bold bg-white outline-none focus:border-indigo-500" value={formData.target_level} onChange={e => setFormData({...formData, target_level: e.target.value})}>
              {levelOptions.map(opt => <option key={opt} value={opt}>{opt}반</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase">Class Name</label>
            <input className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-indigo-500 shadow-sm" value={formData.class_name} onChange={e => setFormData({...formData, class_name: e.target.value})} placeholder="클래스명 입력" />
          </div>
          <div>
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase">Teacher</label>
            <input className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-indigo-500 shadow-sm" value={formData.teacher_name} onChange={e => setFormData({...formData, teacher_name: e.target.value})} placeholder="담당 강사" />
          </div>
          <div>
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase">💰 Tuition</label>
            <input type="number" className="w-full border-2 p-3.5 rounded-2xl font-black outline-none focus:border-indigo-500 shadow-sm text-indigo-600" value={formData.tuition_fee} onChange={e => setFormData({...formData, tuition_fee: parseInt(e.target.value) || 0})} />
          </div>
        </div>

        {/* 행 2: 과목 설정 (동적 추가 버전) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-black text-rose-500 block uppercase tracking-widest font-black">📝 Subject Categories & Descriptions</label>
            <button 
              onClick={() => addSubjectField(false)}
              className="bg-rose-500 text-white w-8 h-8 rounded-full font-black hover:bg-rose-600 transition-colors shadow-md"
            >
              +
            </button>
          </div>
          
          <div className="space-y-3">
            {formData.test_categories.map((cat, index) => (
              <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2">
                <div className="flex-[1]">
                  <input 
                    className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-rose-400 shadow-sm bg-rose-50/10" 
                    value={cat.name} 
                    onChange={e => handleSubjectChange(index, 'name', e.target.value, false)} 
                    placeholder="과목명 (예: 단어)" 
                  />
                </div>
                <div className="flex-[2]">
                  <input 
                    className="w-full border-2 p-3.5 rounded-2xl font-bold outline-none focus:border-rose-400 shadow-sm bg-rose-50/10" 
                    value={cat.description} 
                    onChange={e => handleSubjectChange(index, 'description', e.target.value, false)} 
                    placeholder="상세 설명 (예: 수능 필수 어휘 2000)" 
                  />
                </div>
                {formData.test_categories.length > 1 && (
                  <button 
                    onClick={() => removeSubjectField(index, false)}
                    className="p-3.5 text-rose-300 hover:text-rose-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 행 3: 개강년도 및 요일 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-3">
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase font-black">Opening Year</label>
            <select className="w-full border-2 p-3.5 rounded-2xl font-black text-sm outline-none focus:border-indigo-500 bg-indigo-50 text-indigo-700" value={formData.start_year} onChange={e => setFormData({...formData, start_year: parseInt(e.target.value)})}>
              {yearOptions.map(y => <option key={y} value={y}>{y}년도 개강</option>)}
            </select>
          </div>
          <div className="lg:col-span-9">
            <label className="text-xs font-black text-gray-400 mb-2 block uppercase font-black">Days (수업 요일)</label>
            <div className="flex gap-1.5">
              {Object.keys(dayLabels).map(d => (
                <button key={d} onClick={() => handleToggleDay(d)} className={`flex-1 py-4 rounded-2xl font-black transition-all ${formData[d as keyof typeof formData] ? 'bg-indigo-600 text-white shadow-lg -translate-y-1' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}>{dayLabels[d]}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 행 4: 시간 설정 */}
        <div className="flex flex-wrap gap-8 items-center bg-slate-50 p-6 rounded-[2rem]">
          <TimePicker label="수업 시작 시간" value={formData.start_time} onChange={val => setFormData({...formData, start_time: val})} />
          <div className="text-indigo-200 font-black text-2xl hidden md:block pt-4">→</div>
          <TimePicker label="수업 종료 시간" value={formData.end_time} onChange={val => setFormData({...formData, end_time: val})} />
          <div className="flex-1 text-right pt-4">
              <span className="text-xs font-bold text-slate-400 italic">설정된 요일과 시간에 맞춰 출석부가 생성됩니다.</span>
          </div>
        </div>

        <button onClick={addClass} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-indigo-700 shadow-2xl transition-all active:scale-[0.98] mt-4">새로운 클래스 등록하기 ✨</button>
      </div>

      {/* 리스트 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        {classes.map((c) => (
          <div key={c.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl transition-all flex flex-col gap-6 relative group">
            <div className="flex justify-between items-start">
              <div className="flex gap-2">
                <span className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-tighter">{c.target_level} 반</span>
                <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-[14px] font-black uppercase tracking-tighter">{c.start_year}년 개강</span>
              </div>
              <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEditModal(c)} className="text-indigo-500 hover:underline font-black text-xs">수정</button>
                <button onClick={() => deleteClass(c.id)} className="text-rose-300 hover:text-rose-600 font-black text-xs">삭제</button>
              </div>
            </div>

            <div className="flex justify-between items-end border-b pb-4 gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight break-keep line-clamp-1">{c.class_name}</h3>
                <p className="text-sm font-bold text-slate-400 italic mt-1">Teacher. {c.teacher_name || 'TBA'}</p>
              </div>
              <div className="text-right flex-shrink-0 whitespace-nowrap">
                <span className="text-[10px] font-black text-slate-300 uppercase block mb-1 tracking-widest">Monthly</span>
                <span className="text-xl md:text-2xl font-black text-indigo-600 tracking-tight italic">{formatKRW(c.tuition_fee)}</span>
              </div>
            </div>

            {/* 과목 리스트 렌더링 수정 */}
            <div className="flex flex-wrap gap-2">
  {Array.isArray(c.test_categories) && c.test_categories.map((name: string, i: number) => (
    <div key={i} className="group/item relative">
      <span className="px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[11px] font-black border border-rose-100 cursor-help">
        #{name}
      </span>
      {/* 설명을 category_descriptions[i]에서 가져옴 */}
      {c.category_descriptions?.[i] && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover/item:block w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl z-10">
          {c.category_descriptions[i]}
        </div>
      )}
    </div>
  ))}
</div>

            <div className="bg-slate-50 p-6 rounded-[2.5rem] flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Class Days</span>
                <div className="flex gap-2 flex-wrap">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                    <span key={d} className={`w-10 h-10 flex items-center justify-center rounded-2xl text-xs font-black transition-all ${c[d] ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-white text-slate-200 border border-slate-100'}`}>{dayLabels[d]}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Schedule</span>
                <div className="font-black text-indigo-700 text-lg tracking-tight flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {parseTimeToParts(c.start_time).hour}:{parseTimeToParts(c.start_time).minute} <span className="text-indigo-300 font-light">~</span> {parseTimeToParts(c.end_time).hour}:{parseTimeToParts(c.end_time).minute}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- 수정 모달 --- */}
      {isEditModalOpen && editingClass && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border-4 border-indigo-600">
            <div className="p-8 bg-indigo-600 text-white font-black flex justify-between items-center">
              <h2 className="text-2xl italic uppercase tracking-tighter">Edit Class Details</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-3xl hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="p-10 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <input className="border-2 p-4 rounded-2xl font-bold" value={editingClass.class_name} onChange={e => setEditingClass({...editingClass, class_name: e.target.value})} placeholder="클래스명" />
                <input className="border-2 p-4 rounded-2xl font-bold" value={editingClass.teacher_name} onChange={e => setEditingClass({...editingClass, teacher_name: e.target.value})} placeholder="선생님" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select className="border-2 p-4 rounded-2xl font-bold" value={editingClass.target_level} onChange={e => setEditingClass({...editingClass, target_level: e.target.value})}>
                  {levelOptions.map(opt => <option key={opt} value={opt}>{opt}반</option>)}
                </select>
                <input type="number" className="border-2 p-4 rounded-2xl font-black text-indigo-600" value={editingClass.tuition_fee} onChange={e => setEditingClass({...editingClass, tuition_fee: parseInt(e.target.value) || 0})} />
              </div>

              {/* 수정 모달 내 과목 설정 */}
              <div className="space-y-3 p-6 bg-rose-50/20 rounded-[2rem] border border-rose-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-rose-500 uppercase">Subject Categories</span>
                  <button onClick={() => addSubjectField(true)} className="bg-rose-500 text-white w-6 h-6 rounded-full text-xs">+</button>
                </div>
                {editingClass.test_categories.map((cat: any, index: number) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input className="flex-1 border-2 p-3 rounded-xl font-bold text-sm" value={cat.name} onChange={e => handleSubjectChange(index, 'name', e.target.value, true)} placeholder="과목명" />
                    <input className="flex-[2] border-2 p-3 rounded-xl font-bold text-sm" value={cat.description} onChange={e => handleSubjectChange(index, 'description', e.target.value, true)} placeholder="설명" />
                    <button onClick={() => removeSubjectField(index, true)} className="text-rose-300 p-1">✕</button>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-50 rounded-[2rem] flex flex-col gap-4">
                <div className="flex gap-1">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                    <button key={d} onClick={() => handleToggleDay(d, true)} className={`flex-1 py-3 rounded-xl font-black transition-all ${editingClass[d] ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300'}`}>{dayLabels[d]}</button>
                  ))}
                </div>
                <div className="flex gap-4 justify-center">
                  <TimePicker label="시작" value={editingClass.start_time} onChange={val => setEditingClass({...editingClass, start_time: val})} />
                  <TimePicker label="종료" value={editingClass.end_time} onChange={val => setEditingClass({...editingClass, end_time: val})} />
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-4">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 bg-white rounded-2xl">취소</button>
              <button onClick={updateClass} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700">정보 업데이트 완료 ✅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}