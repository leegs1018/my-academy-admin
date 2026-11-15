import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '../_auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const db = createAdminClient();
  const { data, error } = await db
    .from('fixed_costs')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fixedCosts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const body = await request.json() as {
    type: 'revenue' | 'expense';
    title: string;
    description?: string;
    start_date: string;
    end_date?: string | null;
    repeat_cycle: 'weekly' | 'monthly' | 'once';
    currency: 'KRW' | 'USD';
    amount: number;
    payment_method?: string;
  };

  if (!body.title?.trim() || !body.start_date || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: '필수 항목이 누락됐습니다.' }, { status: 400 });
  }
  if (!['revenue', 'expense'].includes(body.type)) {
    return NextResponse.json({ error: '구분 값이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!['weekly', 'monthly', 'once'].includes(body.repeat_cycle)) {
    return NextResponse.json({ error: '반복 주기가 올바르지 않습니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('fixed_costs')
    .insert({
      type: body.type,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      start_date: body.start_date,
      end_date: body.repeat_cycle === 'once' ? null : (body.end_date || null),
      repeat_cycle: body.repeat_cycle,
      currency: body.currency ?? 'KRW',
      amount: body.amount,
      payment_method: body.payment_method?.trim() || null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fixedCost: data });
}

export async function PUT(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const body = await request.json() as {
    id: string;
    type: 'revenue' | 'expense';
    title: string;
    description?: string;
    start_date: string;
    end_date?: string | null;
    repeat_cycle: 'weekly' | 'monthly' | 'once';
    currency: 'KRW' | 'USD';
    amount: number;
    payment_method?: string;
  };

  if (!body.id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  if (!body.title?.trim() || !body.start_date || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: '필수 항목이 누락됐습니다.' }, { status: 400 });
  }
  if (!['revenue', 'expense'].includes(body.type)) {
    return NextResponse.json({ error: '구분 값이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!['weekly', 'monthly', 'once'].includes(body.repeat_cycle)) {
    return NextResponse.json({ error: '반복 주기가 올바르지 않습니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('fixed_costs')
    .update({
      type: body.type,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      start_date: body.start_date,
      end_date: body.repeat_cycle === 'once' ? null : (body.end_date || null),
      repeat_cycle: body.repeat_cycle,
      currency: body.currency ?? 'KRW',
      amount: body.amount,
      payment_method: body.payment_method?.trim() || null,
    })
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fixedCost: data });
}

export async function DELETE(request: NextRequest) {
  const authError = await requireSuperAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('fixed_costs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
