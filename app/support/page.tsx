import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center rotate-3">
            <span className="text-yellow-400 font-black text-sm italic">C</span>
          </div>
          <span className="text-lg font-black tracking-tighter">CON <span className="text-yellow-500">EDU</span></span>
        </Link>
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">← 홈으로</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-32 text-center">
        <div className="text-6xl mb-8">💬</div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">고객센터</h1>
        <p className="text-slate-400 font-medium text-lg mb-10 leading-relaxed">
          채팅 문의 서비스를 준비 중입니다.<br />
          현재는 아래 이메일로 문의해 주세요.
        </p>
        <a
          href="mailto:contact@bfai.ai"
          className="inline-block px-10 py-4 bg-slate-900 text-white font-black rounded-full text-lg hover:bg-slate-800 transition-all hover:-translate-y-0.5"
        >
          contact@bfai.ai
        </a>
        <p className="mt-6 text-sm text-slate-400 font-medium">운영시간: 평일 10:00 ~ 18:00 (주말·공휴일 제외)</p>
      </div>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400 font-medium">
        <p>© 2026 CON EDU. All rights reserved.</p>
      </footer>
    </div>
  );
}
