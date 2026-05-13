'use client';

interface ConInsufficientModalProps {
  isOpen: boolean;
  onClose: () => void;
  required: number;
  balance: number;
}

export default function ConInsufficientModal({ isOpen, onClose, required, balance }: ConInsufficientModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-gray-900 px-6 py-5 text-center">
          <div className="text-4xl mb-2">⭐</div>
          <h2 className="text-lg font-black text-white">CON이 부족합니다</h2>
          <p className="text-sm text-gray-400 mt-1">기능을 사용하려면 CON을 충전해주세요</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-500">현재 잔액</span>
              <span className="text-sm font-black text-gray-900">{balance.toLocaleString()} C</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-500">필요한 CON</span>
              <span className="text-sm font-black text-red-500">{required.toLocaleString()} C</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
              <span className="text-sm font-black text-gray-700">부족한 CON</span>
              <span className="text-sm font-black text-red-600">{Math.max(0, required - balance).toLocaleString()} C</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <p className="text-xs font-black text-yellow-700 mb-1">CON 충전 안내</p>
            <p className="text-xs text-yellow-600 font-bold leading-relaxed">
              100 CON = 10,000원<br />
              충전은 아래 연락처로 문의해주세요.
            </p>
            <div className="mt-3 space-y-1.5">
              <a
                href="tel:031-903-8205"
                className="flex items-center gap-2 text-xs font-black text-gray-700 hover:text-gray-900"
              >
                <span>📞</span> 031-903-8205
              </a>
              <a
                href="http://pf.kakao.com/_xjxaExj"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-black text-yellow-700 hover:text-yellow-800"
              >
                <span>💬</span> 카카오 채널 문의하기
              </a>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-black rounded-2xl hover:bg-gray-200 transition-all text-sm"
          >
            닫기
          </button>
          <a
            href="/admin/account"
            className="flex-1 py-3 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all text-sm text-center"
          >
            충전 내역 보기
          </a>
        </div>
      </div>
    </div>
  );
}
