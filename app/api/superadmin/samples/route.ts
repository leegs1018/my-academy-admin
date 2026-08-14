import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

const db = createAdminClient();

export async function POST(req: NextRequest) {
  const authErr = await requireSuperAdmin(req);
  if (authErr) return authErr;

  const formData = await req.formData();
  const file     = formData.get('file')     as File   | null;
  const title    = formData.get('title')    as string | null;
  const category = formData.get('category') as string | null;

  if (!file || !title) return NextResponse.json({ error: '파일과 제목은 필수입니다.' }, { status: 400 });

  const ext  = file.name.split('.').pop() ?? 'pdf';
  const path = `samples/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await db.storage
    .from('site-assets')
    .upload(path, buffer, { upsert: false, contentType: file.type });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: urlData } = db.storage.from('site-assets').getPublicUrl(path);

  const { data: inserted, error: dbErr } = await db
    .from('sample_files')
    .insert({
      title,
      category: category || '실전변형문제',
      file_url:  urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ file: inserted });
}

export async function DELETE(req: NextRequest) {
  const authErr = await requireSuperAdmin(req);
  if (authErr) return authErr;

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const { data: row } = await db.from('sample_files').select('file_url').eq('id', id).single();
  if (row?.file_url) {
    const path = row.file_url.split('/site-assets/')[1];
    if (path) await db.storage.from('site-assets').remove([path]);
  }

  await db.from('sample_files').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
