import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from '../_auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authErr = await requireSuperAdmin(req);
  if (authErr) return authErr;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `favicon.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from('site-assets')
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabaseAdmin.storage.from('site-assets').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  // site_settings에도 저장
  await supabaseAdmin
    .from('site_settings')
    .upsert({ key: 'site_logo_url', value: publicUrl }, { onConflict: 'key' });

  return NextResponse.json({ url: publicUrl });
}
