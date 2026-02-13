'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 현재 페이지가 로그인 페이지인지 확인
  const isLoginPage = pathname === '/login';

  // 로그아웃 함수
  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      setIsOpen(false);
      router.push('/login'); 
    }
  };

  // 메뉴 아이템 설정 (반복되는 코드를 줄이기 위해 배열로 관리)
  const menuItems = [
    { href: '/', label: '홈 대시보드', icon: '🏠' },
    { href: '/admin/student', label: '학생 등록 관리', icon: '👤' },
    { href: '/admin/class', label: '클래스 관리', icon: '🏫' },
    { href: '/admin/grade-input', label: '성적 입력', icon: '✍️', color: 'hover:bg-indigo-50' }, // 추가
    { href: '/admin/report', label: '성적표 분석', icon: '📈', color: 'hover:bg-indigo-50' }, // 추가
    { href: '/admin/student-list', label: '학생 통합 명부', icon: '📋' },
    { href: '/admin/attendance', label: '일정 및 출석관리', icon: '✅', color: 'hover:bg-green-50' },
    { href: '/admin/notices', label: '공지사항', icon: '📢', color: 'hover:bg-yellow-50' },
  ];

  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">
        
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
                  {menuItems.map((item) => (
                    <Link 
                      key={item.href}
                      href={item.href} 
                      onClick={() => setIsOpen(false)} 
                      className={`group flex items-center p-4 ${item.color || 'hover:bg-indigo-50'} rounded-2xl transition-all ${pathname === item.href ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}
                    >
                      <span className="text-xl mr-3 group-hover:scale-125 transition-transform">{item.icon}</span>
                      <span className={`font-black text-lg ${pathname === item.href ? 'text-indigo-600' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                    </Link>
                  ))}
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
        <main className={`min-h-screen ${isLoginPage ? '' : 'pt-20 px-6'}`}>
          <div className={isLoginPage ? '' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}