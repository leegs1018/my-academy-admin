'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [classList, setClassList] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<any>({});

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsAndAttendance();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('class_name').order('class_name');
    if (data) setClassList(data);
  };

  const fetchStudentsAndAttendance = async () => {
    // 1. 해당 클래스 학생들 가져오기
    const { data: studentData } = await supabase
      .from('students')
      .select('id, name, class_name')
      .eq('class_name', selectedClass);
    
    // 2. 해당 날짜의 출석 기록 가져오기
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', selectedDate)
      .eq('class_name', selectedClass);

    if (studentData) setStudents(studentData);

    // 기록을 맵 형태로 변환 {studentId: status}
    const map: any = {};
    attendanceData?.forEach(record => {
      map[record.student_id] = record.status;
    });
    setAttendanceMap(map);
  };

  const handleAttendance = async (student: any, status: string) => {
    const currentStatus = attendanceMap[student.id];

    if (currentStatus === status) {
      // 이미 같은 상태면 기록 삭제 (취소)
      await supabase.from('attendance').delete()
        .eq('student_id', student.id)
        .eq('attendance_date', selectedDate);
      
      const newMap = { ...attendanceMap };
      delete newMap[student.id];
      setAttendanceMap(newMap);
    } else {
      // 새로운 상태 저장 (업데이트 또는 삽입)
      const { error } = await supabase.from('attendance').upsert({
        student_id: student.id,
        student_name: student.name,
        class_name: student.class_name,
        status: status,
        attendance_date: selectedDate
      }, { onConflict: 'student_id, attendance_date' });

      if (!error) {
        setAttendanceMap({ ...attendanceMap, [student.id]: status });
      }
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-green-100 pb-6">
        <h1 className="text-3xl font-black text-green-700">✅ 출석 체크</h1>
        <div className="flex gap-2">
          <input 
            type="date" 
            className="border-2 p-2 rounded-xl font-bold text-gray-700 outline-none focus:border-green-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* 클래스 선택 탭 */}
      <div className="flex flex-wrap gap-2">
        {classList.map((c) => (
          <button
            key={c.class_name}
            onClick={() => setSelectedClass(c.class_name)}
            className={`px-4 py-2 rounded-full font-black text-sm transition-all shadow-sm ${
              selectedClass === c.class_name 
              ? 'bg-green-600 text-white scale-105' 
              : 'bg-white text-gray-500 border hover:bg-green-50'
            }`}
          >
            {c.class_name}
          </button>
        ))}
      </div>

      {/* 출석 체크 리스트 */}
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden">
        {selectedClass ? (
          <div className="divide-y divide-gray-100">
            <div className="bg-gray-50 p-4 flex justify-between items-center font-black text-gray-400 text-xs uppercase">
              <span>학생 이름</span>
              <span className="mr-20">출석 상태 선택</span>
            </div>
            {students.map((student) => (
              <div key={student.id} className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4 hover:bg-green-50/30 transition-colors">
                <div className="font-black text-xl text-gray-800">{student.name}</div>
                
                <div className="flex gap-2">
                  {['등원', '결석', '조퇴'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleAttendance(student, status)}
                      className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all border-2 ${
                        attendanceMap[student.id] === status
                        ? status === '등원' ? 'bg-green-600 border-green-600 text-white shadow-lg' :
                          status === '결석' ? 'bg-red-500 border-red-500 text-white shadow-lg' :
                          'bg-orange-400 border-orange-400 text-white shadow-lg'
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {students.length === 0 && (
              <div className="p-20 text-center text-gray-400 font-bold">이 클래스에 등록된 학생이 없습니다.</div>
            )}
          </div>
        ) : (
          <div className="p-20 text-center text-gray-400 space-y-3">
            <div className="text-5xl">👈</div>
            <p className="font-black text-xl">출석을 체크할 클래스를 상단에서 선택해 주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}