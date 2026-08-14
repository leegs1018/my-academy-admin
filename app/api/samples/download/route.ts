import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ ok: false });
  const db = createAdminClient();
  await db.rpc('increment_sample_download', { p_id: id }).catch(() => {});
  return NextResponse.json({ ok: true });
}
