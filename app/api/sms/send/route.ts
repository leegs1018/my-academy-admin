import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { createClient } from '@supabase/supabase-js';
import { getFeaturePrice, getConBalance } from '@/lib/credits';
import { createAdminClient } from '@/lib/supabase-admin';

interface Recipient {
  student_id: string;
  name: string;
  phone: string;
}

export async function POST(req: Request) {
  const { message, recipients, academy_id } = await req.json() as {
    message: string;
    recipients: Recipient[];
    academy_id?: string;
  };

  if (!message || !recipients || recipients.length === 0) {
    return NextResponse.json({ error: '메시지와 수신자를 입력해주세요.' }, { status: 400 });
  }

  // CON 잔액 확인 및 차감
  if (academy_id) {
    const pricePerSms = await getFeaturePrice('sms');
    const totalCost = pricePerSms * recipients.length;

    if (totalCost > 0) {
      const balance = await getConBalance(academy_id);
      if (balance < totalCost) {
        return NextResponse.json({
          error: 'INSUFFICIENT_CON',
          required: totalCost,
          balance,
          price_per_sms: pricePerSms,
        }, { status: 402 });
      }

      // 원자적 차감 (RPC)
      const supabaseAdmin = createAdminClient();
      const { error: deductError } = await supabaseAdmin.rpc('deduct_con', {
        p_academy_id: academy_id,
        p_amount: totalCost,
        p_feature_key: 'sms',
        p_description: `SMS 발송 ${recipients.length}건`,
      });

      if (deductError) {
        if (deductError.message?.includes('INSUFFICIENT_CON')) {
          return NextResponse.json({
            error: 'INSUFFICIENT_CON',
            required: totalCost,
            balance,
            price_per_sms: pricePerSms,
          }, { status: 402 });
        }
        return NextResponse.json({ error: 'CON 차감 중 오류가 발생했습니다.' }, { status: 500 });
      }
    }
  }

  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER_NUMBER;

  if (!apiKey || !apiSecret || !sender) {
    return NextResponse.json({ error: '서버 환경변수 설정 오류' }, { status: 500 });
  }

  // 학원 이름 조회
  let subject = '알림';
  if (academy_id) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: cfg } = await supabase
      .from('academy_config')
      .select('academy_name')
      .eq('user_id', academy_id)
      .single();
    if (cfg?.academy_name) subject = cfg.academy_name;
  }

  const results: { student_id: string; name: string; phone: string; status: 'success' | 'fail'; error?: string }[] = [];

  for (const recipient of recipients) {
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2, 12);
    const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();
    const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    try {
      const res = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            to: recipient.phone.replace(/-/g, ''),
            from: sender.replace(/-/g, ''),
            text: message,
            subject,
          },
        }),
      });

      const result = await res.json();

      if (result.errorCode) {
        results.push({ student_id: recipient.student_id, name: recipient.name, phone: recipient.phone, status: 'fail', error: result.errorMessage || result.errorCode });
      } else {
        results.push({ student_id: recipient.student_id, name: recipient.name, phone: recipient.phone, status: 'success' });
      }
    } catch {
      results.push({ student_id: recipient.student_id, name: recipient.name, phone: recipient.phone, status: 'fail', error: '발송 서버 오류' });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  return NextResponse.json({
    total: results.length,
    success: successCount,
    fail: failCount,
    results,
  });
}
