'use client';

import { useState } from 'react';
import Link from 'next/link';
import './globals.css'; // 디자인 설정을 불러옵니다

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">
        {/* 1. 햄버거 버튼 (항상 왼쪽 위에 고정) */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-5 left-5 z-[100] p-3 bg-indigo-600 text-white rounded-xl shadow-2xl hover:bg-indigo-700 transition-all active:scale-90"
        >
          {isOpen ? (
            <span className="text-xl font-bold">✕ 닫기</span>
          ) : (
            <div className="space-y-1.5">
              <div className="w-7 h-1 bg-white rounded-full"></div>
              <div className="w-7 h-1 bg-white rounded-full"></div>
              <div className="w-7 h-1 bg-white rounded-full"></div>
            </div>
          )}
        </button>

        {/* 2. 사이드바 메뉴 (평소에는 왼쪽 밖(-100%)에 숨어있음) */}
        <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-[10px_0_30px_rgba(0,0,0,0.1)] z-[90] transform transition-transform duration-300 ease-in-out border-r-2 border-indigo-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-8 pt-24 flex flex-col gap-4">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-black text-indigo-600 italic">이주영 영어학원</h2>
              <p className="text-xs font-bold text-gray-400 tracking-tighter">MANAGEMENT SYSTEM</p>
            </div>
            
            <Link href="/" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-indigo-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:scale-125 transition-transform">🏠</span>
              <span className="font-black text-lg text-gray-700">홈 대시보드</span>
            </Link>

            <Link href="/student" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-indigo-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:scale-125 transition-transform">👤</span>
              <span className="font-black text-lg text-gray-700">학생 등록 관리</span>
            </Link>

            <Link href="/class" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-indigo-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:scale-125 transition-transform">🏫</span>
              <span className="font-black text-lg text-gray-700">클래스 관리</span>
            </Link>

            <Link href="/grade" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-indigo-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:scale-125 transition-transform">📊</span>
              <span className="font-black text-lg text-gray-700">성적 입력 & 분석</span>
            </Link>

            <Link href="/student-list" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-indigo-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:scale-125 transition-transform">📋</span>
              <span className="font-black text-lg text-gray-700">학생 통합 명부</span>
            </Link>

            <Link href="/attendance" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-green-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:scale-125 transition-transform">✅</span>
              <span className="font-black text-lg text-gray-700">출석 체크</span>
            </Link>

            <Link href="/notices" onClick={() => setIsOpen(false)} className="group flex items-center p-4 hover:bg-yellow-50 rounded-2xl transition-all">
              <span className="text-xl mr-3 group-hover:rotate-12 transition-transform">📢</span>
              <span className="font-black text-lg text-gray-700">공지사항</span>
            </Link>
            <div className="mt-20 p-4 bg-indigo-50 rounded-2xl">
              <p className="text-xs text-indigo-400 font-bold text-center">오늘도 화이팅입니다 원장님! 😊</p>
            </div>
          </div>
        </div>

        {/* 3. 메뉴가 열렸을 때 뒷배경을 어둡게 (클릭 시 닫힘) */}
        {isOpen && (
          <div 
            onClick={() => setIsOpen(false)} 
            className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm z-[80] transition-opacity"
          ></div>
        )}

        {/* 4. 실제 페이지 내용이 표시되는 곳 */}
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}