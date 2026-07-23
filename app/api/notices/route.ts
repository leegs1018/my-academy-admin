import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const db = createAdminClient();
  const { data } = await db
    .from('system_notices')
    .select('id, title, content, is_important, created_at')
    .eq('is_published', true)
    .order('is_important', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  return NextResponse.json({ notices: data ?? [] });
}
