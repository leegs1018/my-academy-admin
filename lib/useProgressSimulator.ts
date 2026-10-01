'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// AI 생성처럼 중간 진행률을 서버에서 받을 수 없는(스트리밍 없는 단일 API 콜) 작업에서,
// "멈춘 건지 아닌지 헷갈린다"는 피드백을 해결하기 위한 진행률 시뮬레이터.
// - 완료된 항목 수(completed/total)는 실측값 그대로 반영하고,
// - 아직 끝나지 않은 항목들은 경과 시간에 따라 0 → 0.9까지 점근적으로 "크리프"시켜
//   화면이 계속 움직이는 것처럼 보이게 한다(실제 완료 전까지 99%를 넘지 않음).
// 여러 항목이 동시에(병렬로) 시작되는 배치 생성에 맞춰, 크리프는 배치 시작 시각 기준
// 하나로 공유하고 "아직 안 끝난 항목 수"에만 곱해서 적용한다.
export interface ProgressController {
  percent: number;
  start: (total: number) => void;
  complete: () => void;
  finish: () => void;
  stop: () => void;
}

export function useProgressSimulator(estimatedSecondsPerItem = 20): ProgressController {
  const [percent, setPercent] = useState(0);
  const totalRef = useRef(1);
  const completedRef = useRef(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const recompute = useCallback(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const creep = 0.9 * (1 - Math.exp(-elapsed / estimatedSecondsPerItem));
    const total = totalRef.current;
    const remaining = total - completedRef.current;
    const raw = ((completedRef.current + remaining * creep) / total) * 100;
    setPercent(Math.min(99, Math.round(raw)));
  }, [estimatedSecondsPerItem]);

  const start = useCallback((total: number) => {
    totalRef.current = Math.max(1, total);
    completedRef.current = 0;
    startTimeRef.current = Date.now();
    setPercent(0);
    clearTimer();
    timerRef.current = setInterval(recompute, 400);
  }, [clearTimer, recompute]);

  const complete = useCallback(() => {
    completedRef.current = Math.min(totalRef.current, completedRef.current + 1);
    recompute();
  }, [recompute]);

  const finish = useCallback(() => {
    clearTimer();
    setPercent(100);
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { percent, start, complete, finish, stop };
}
