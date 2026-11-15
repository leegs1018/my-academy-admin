import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { getUsdKrwRate, todayKst } from '@/lib/fxRate';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || todayKst();

  try {
    const { date: rateDate, rate } = await getUsdKrwRate(date);
    return NextResponse.json({ date: rateDate, rate });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
