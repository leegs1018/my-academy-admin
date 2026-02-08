'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation'; // 1. usePathname 추가
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // 2. 현재 주소(경로) 가져오기

  // 3. 현재 페이지가 로그인 페이지인지 확인
  const isLoginPage = pathname === '/login';

  // 로그아웃 함수
  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      setIsOpen(false);
      router.push('/login'); 
    }
  };

  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">
        
        {/* --- 로그인 페이지가 아닐 때만 햄버거 버튼과 사이드바 표시 --- */}
        {!isLoginPage && (
          <>
            {/* 1. 햄버거 버튼 */}
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

            {/* 2. 사이드바 메뉴 */}
            <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-[10px_0_30px_rgba(0,0,0,0.1)] z-[90] transform transition-transform duration-300 ease-in-out border-r-2 border-indigo-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="p-8 pt-24 flex flex-col h-full gap-4">
                <div className="mb-10 text-center">
                  <h2 className="text-2xl font-black text-indigo-600 italic">이주영 영어학원</h2>
                  <p className="text-xs font-bold text-gray-400 tracking-tighter">MANAGEMENT SYSTEM</p>
                </div>
                
                {/* 메뉴 리스트 */}
                <div className="flex-1 space-y-2 overflow-y-auto">
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
                </div>

                {/* 하단 로그아웃 버튼 영역 */}
                <div className="mt-auto pt-6 border-t border-gray-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full group flex items-center p-4 hover:bg-red-50 text-red-500 rounded-2xl transition-all"
                  >
                    <span className="text-xl mr-3 group-hover:translate-x-1 transition-transform">🚪</span>
                    <span className="font-black text-lg">로그아웃</span>
                  </button>
                  <div className="mt-4 p-4 bg-indigo-50 rounded-2xl text-center">
                    <p className="text-xs text-indigo-400 font-bold">오늘도 화이팅입니다 원장님! 😊</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 뒷배경 어둡게 */}
            {isOpen && (
              <div 
                onClick={() => setIsOpen(false)} 
                className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm z-[80] transition-opacity"
              ></div>
            )}
          </>
        )}

        {/* 4. 실제 페이지 내용 */}
        {/* 로그인 페이지일 때는 위쪽 여백(pt-20)을 없애서 로그인 폼이 화면 중앙에 오게 함 */}
        <main className={`min-h-screen ${isLoginPage ? '' : 'pt-20 px-6'}`}>
          <div className={isLoginPage ? '' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}