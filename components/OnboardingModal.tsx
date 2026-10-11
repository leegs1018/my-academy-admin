'use client';

interface OnboardingModalProps {
  isOpen: boolean;
  onSelectAi: () => void;
  onSelectDashboard: () => void;
}

export default function OnboardingModal({ isOpen, onSelectAi, onSelectDashboard }: OnboardingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-gray-950 text-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800">
        <div className="flex items-center justify-between px-7 pt-6">
          <span className="text-sm font-black tracking-widest text-gray-400">CONEDU</span>
          <button onClick={onSelectDashboard} className="text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors">
            시작하기 →
          </button>
        </div>

        <div className="px-7 pt-5 pb-2">
          <h2 className="text-2xl font-black">콘에듀에 오신 것을 환영합니다!</h2>
          <p className="text-sm font-bold text-gray-400 mt-1">어떤 기능부터 이용해 보시겠어요?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-7 py-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-2xl mb-5">📖</div>
            <h3 className="text-lg font-black mb-1.5">AI 영어 문제 생성</h3>
            <p className="text-xs font-bold text-gray-400 leading-relaxed flex-1">
              영어 지문 하나로 다양한 워크북과 시험지를 만들어 보세요.
            </p>
            <button onClick={onSelectAi}
              className="mt-5 w-full py-3 bg-white text-gray-900 font-black rounded-xl hover:bg-gray-200 transition-all text-sm">
              무료 체험하기
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-2xl mb-5">🏫</div>
            <h3 className="text-lg font-black mb-1.5">학원관리 시작하기</h3>
            <p className="text-xs font-bold text-gray-400 leading-relaxed flex-1">
              학생 등록부터 출결, 수납, 성적관리까지 시작해 보세요.
            </p>
            <button onClick={onSelectDashboard}
              className="mt-5 w-full py-3 bg-gray-800 text-white font-black rounded-xl hover:bg-gray-700 transition-all text-sm border border-gray-700">
              대시보드로 이동
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] font-bold text-gray-500 pb-6">
          선택한 기능은 나중에도 자유롭게 이용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
