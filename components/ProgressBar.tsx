'use client';

interface ProgressBarProps {
  percent: number;
  label?: string;
  colorClassName?: string;
}

// AI 생성·PDF 병합처럼 "멈춘 건지 아닌지 헷갈리는" 긴 비동기 작업에 공통으로 쓰는 진행률 바.
// percent는 useProgressSimulator가 계산한 값(실측 완료 + 경과시간 기반 추정)을 그대로 받는다.
export default function ProgressBar({ percent, label, colorClassName = 'bg-indigo-500' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full">
      {label && <p className="text-xs font-bold text-slate-500 mb-1 text-center">{label}</p>}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${colorClassName}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-xs font-black text-slate-500 mt-1 text-center tabular-nums">{clamped}%</p>
    </div>
  );
}
