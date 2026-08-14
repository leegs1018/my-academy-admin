import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const db = createAdminClient();
  const { data, error } = await db
    .from('sample_files')
    .select('id, title, category, file_url, file_name, file_size, download_count, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ files: [] });
  return NextResponse.json({ files: data ?? [] });
}
