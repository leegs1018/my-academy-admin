import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

interface TypeStat {
  question_type: string;
  model: string | null;
  total: number;
  succeeded: number;
  avgAttempts: number;
  retryRate: number; // attempts > 1인 비율 (%)
}

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '7') || 7));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('generation_retry_log')
    .select('question_type, model, attempts, success, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { question_type: string; model: string | null; attempts: number; success: boolean }[];

  const byType = new Map<string, { model: string | null; total: number; succeeded: number; attemptsSum: number; retried: number }>();
  for (const r of rows) {
    const key = r.question_type;
    const agg = byType.get(key) ?? { model: r.model, total: 0, succeeded: 0, attemptsSum: 0, retried: 0 };
    agg.total += 1;
    if (r.success) agg.succeeded += 1;
    agg.attemptsSum += r.attempts;
    if (r.attempts > 1) agg.retried += 1;
    agg.model = r.model ?? agg.model;
    byType.set(key, agg);
  }

  const stats: TypeStat[] = [...byType.entries()]
    .map(([question_type, agg]) => ({
      question_type,
      model: agg.model,
      total: agg.total,
      succeeded: agg.succeeded,
      avgAttempts: Math.round((agg.attemptsSum / agg.total) * 100) / 100,
      retryRate: Math.round((agg.retried / agg.total) * 1000) / 10,
    }))
    .sort((a, b) => b.retryRate - a.retryRate);

  return NextResponse.json({ days, totalLogged: rows.length, stats });
}
