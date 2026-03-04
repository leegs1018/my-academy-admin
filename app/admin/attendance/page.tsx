'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './calendar-custom.css';

export default function AttendancePage() {
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [classList, setClassList] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [allNotes, setAllNotes] = useState<any[]>([]);

  useEffect(() => {
    fetchClasses();
    fetchAllNotes();
    fetchAllStudents();
  }, []);

  useEffect(() => {
    fetchAttendance();
    fetchDateNote(selectedDate);
  }, [selectedClass, selectedDate]);

  const onDateChange = (newDate: any) => {
    const dateStr = newDate.toLocaleDateString('sv-SE');
    setDate(newDate);
    setSelectedDate(dateStr);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('class_name').order('class_name');
    if (data) setClassList(data);
  };

  const fetchAllStudents = async () => {
    const { data } = await supabase.from('students').select('id, name, class_name, parent_phone').order('name');
    if (data) setAllStudents(data);
  };

  const fetchAllNotes = async () => {
    const { data } = await supabase.from('calendar_notes').select('note_date');
    if (data) setAllNotes(data.map(n => n.note_date));
  };

  const fetchDateNote = async (dateStr: string) => {
    const { data } = await supabase.from('calendar_notes').select('content').eq('note_date', dateStr).maybeSingle();
    setNoteInput(data ? data.content : '');
  };

  // ✅ 알림 발송 함수 (서버 API 호출)
  const sendAttendanceNotification = async (student: any, status: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (!student.parent_phone) {
      console.warn(`${student.name} 학생의 학부모 연락처가 없습니다.`);
      return;
    }

    try {
      const res = await fetch('/api/attendance/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: student.parent_phone,
          studentName: student.name,
          status: status,
          attendance_date: selectedDate, // 현재 선택된 날짜 (YYYY-MM-DD)
          time: timeStr
        })
      });
      if (res.ok) console.log(`${status} 알림 전송 성공`);
    } catch (err) {
      console.error('알림 발송 중 오류:', err);
    }
  };

  // ✅ 출결 처리 통합 함수
  const handleAttendance = async (student: any, status: string) => {
    const currentStatus = attendanceMap[student.id];

    if (currentStatus === status) {
      const { error } = await supabase.from('attendance').delete().eq('student_id', student.id).eq('attendance_date', selectedDate);
      if (!error) {
        const newMap = { ...attendanceMap };
        delete newMap[student.id];
        setAttendanceMap(newMap);
      }
      return;
    }

    const { error } = await supabase.from('attendance').upsert({ 
      student_id: student.id, 
      student_name: student.name, 
      class_name: student.class_name, 
      status, 
      attendance_date: selectedDate 
    }, { onConflict: 'student_id, attendance_date' });

    if (!error) {
      setAttendanceMap({ ...attendanceMap, [student.id]: status });
      // 등원/하원 시에만 알림 발송
      if (status === '등원' || status === '하원') {
        sendAttendanceNotification(student, status);
      }
    } else {
      alert('출결 저장 실패');
    }
  };

  // ... 나머지 메모 저장/삭제 및 필터 로직 (기존과 동일) ...
  const handleDeleteNote = async () => {
    if (!confirm('이 날의 일정을 완전히 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('calendar_notes').delete().eq('note_date', selectedDate);
    if (!error) {
      setNoteInput('');
      fetchAllNotes();
      alert('삭제되었습니다.');
    }
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim()) return alert('내용을 입력해주세요.');
    const { error } = await supabase.from('calendar_notes').upsert({ note_date: selectedDate, content: noteInput }, { onConflict: 'note_date' });
    if (!error) {
      fetchAllNotes();
      alert('저장되었습니다.');
    }
  };

  const fetchAttendance = async () => {
    let query = supabase.from('attendance').select('*').eq('attendance_date', selectedDate);
    if (selectedClass) query = query.eq('class_name', selectedClass);
    const { data: attendanceData } = await query;
    const map: any = {};
    attendanceData?.forEach(record => { map[record.student_id] = record.status; });
    setAttendanceMap(map);
  };

  const displayedStudents = allStudents.filter(s => {
    const className = s.class_name || '';
    const studentName = s.name || '';
    const matchesClass = selectedClass ? className === selectedClass : true;
    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) || className.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const filteredClasses = classList.filter(c => (c.class_name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-20 font-sans text-gray-900">
      <div className="flex justify-between items-center border-b-4 border-green-100 pb-6">
        <h1 className="text-3xl font-black text-green-700">✅ 출석 및 일정 관리</h1>
        <div className="text-right">
          <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Selected Date</p>
          <p className="text-xl font-black text-green-600">{selectedDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 sticky top-6">
            <Calendar 
              onChange={onDateChange} 
              value={date} 
              calendarType="gregory" 
              locale="ko-KR" 
              formatDay={(l, d) => d.getDate().toString()}
              tileContent={({ date }) => allNotes.includes(date.toLocaleDateString('sv-SE')) ? <div className="dot"></div> : null} 
            />
            <div className="mt-6 p-5 bg-green-50 rounded-2xl border-2 border-green-100 space-y-3">
              <p className="font-black text-green-800 flex items-center gap-2">📝 {selectedDate} 일정 메모</p>
              <textarea 
                rows={3}
                placeholder="내용을 입력하세요..." 
                className="w-full p-3 rounded-xl border-2 border-white focus:border-green-500 outline-none font-bold shadow-sm resize-none" 
                value={noteInput} 
                onChange={(e) => setNoteInput(e.target.value)} 
              />
              <div className="flex gap-2">
                <button onClick={handleDeleteNote} className="flex-1 bg-white text-rose-500 py-3 rounded-xl font-black hover:bg-rose-50 transition-all border-2 border-rose-100 shadow-sm">삭제</button>
                <button onClick={handleSaveNote} className="flex-[2] bg-green-700 text-white py-3 rounded-xl font-black hover:bg-green-800 transition-all shadow-md">저장하기</button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-gray-400">🔍</span>
            <input 
              type="text"
              placeholder="클래스명 또는 학생 이름을 검색하세요..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-green-500 outline-none font-bold text-lg shadow-sm transition-all bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedClass('')} className={`px-5 py-2 rounded-full font-black text-sm transition-all shadow-sm ${!selectedClass ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border'}`}>전체보기</button>
            {filteredClasses.map((c) => (
              <button key={c.class_name} onClick={() => setSelectedClass(c.class_name)} className={`px-5 py-2 rounded-full font-black text-sm transition-all shadow-sm ${selectedClass === c.class_name ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border hover:bg-green-50'}`}>{c.class_name}</button>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden min-h-[500px]">
            <div className="divide-y divide-gray-100">
              <div className="bg-gray-50/50 p-4 flex justify-between font-black text-gray-400 text-xs uppercase tracking-widest">
                <span>학생 이름 ({displayedStudents.length}명)</span>
                <span className="mr-10">출석 상태 선택</span>
              </div>
              {displayedStudents.map((student) => (
                <div key={student.id} className="p-5 flex justify-between items-center hover:bg-green-50/30 transition-colors">
                  <div>
                    <div className="font-black text-xl text-gray-800">{student.name}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase">{student.class_name}</div>
                  </div>
                  <div className="flex gap-2">
                    {['등원', '하원', '결석', '조퇴'].map((status) => (
                      <button 
                        key={status} 
                        onClick={() => handleAttendance(student, status)}
                        className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all border-2 ${
                          attendanceMap[student.id] === status 
                          ? (status === '등원' ? 'bg-green-600 border-green-600 text-white' : 
                             status === '하원' ? 'bg-blue-500 border-blue-500 text-white' :
                             status === '결석' ? 'bg-red-500 border-red-500 text-white' : 
                             'bg-orange-400 border-orange-400 text-white') 
                          : 'bg-white border-gray-100 text-gray-300 hover:border-gray-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}