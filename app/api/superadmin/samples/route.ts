import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

const db = createAdminClient();

async function addWatermark(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // 대각선으로 3줄 × 4열 배치
    const text = 'CON EDU';
    const fontSize = Math.min(width, height) * 0.06;
    const cols = 3;
    const rows = 4;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (width / cols) * (c + 0.5);
        const y = (height / rows) * (r + 0.5);
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.15,
          rotate: degrees(45),
        });
      }
    }
  }

  return pdfDoc.save();
}

export async function POST(req: NextRequest) {
  const authErr = await requireSuperAdmin(req);
  if (authErr) return authErr;

  const formData = await req.formData();
  const file     = formData.get('file')     as File   | null;
  const title    = formData.get('title')    as string | null;
  const category = formData.get('category') as string | null;

  if (!file || !title) return NextResponse.json({ error: '파일과 제목은 필수입니다.' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const path = `samples/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const originalBuffer = await file.arrayBuffer();

  // PDF면 워터마크 삽입, 아니면 원본 그대로
  let uploadBuffer: Buffer;
  let contentType = file.type;
  if (ext === 'pdf') {
    const watermarked = await addWatermark(originalBuffer);
    uploadBuffer = Buffer.from(watermarked);
    contentType = 'application/pdf';
  } else {
    uploadBuffer = Buffer.from(originalBuffer);
  }

  const { error: uploadErr } = await db.storage
    .from('site-assets')
    .upload(path, uploadBuffer, { upsert: false, contentType });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: urlData } = db.storage.from('site-assets').getPublicUrl(path);

  const { data: inserted, error: dbErr } = await db
    .from('sample_files')
    .insert({
      title,
      category: category || '실전변형문제',
      file_url:  urlData.publicUrl,
      file_name: file.name,
      file_size: uploadBuffer.length,
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
