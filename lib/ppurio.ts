import { createClient } from '@supabase/supabase-js';

export interface AttendancePayload {
  type: 'attendance';
  to: string;
  academyName: string;
  studentName: string;
  date: string;
  status: '등원' | '하원';
}

export interface GradePayload {
  type: 'grade';
  to: string;
  academyName: string;
  studentName: string;
  date: string;
  content: string;
}

export type AlimtalkPayload = AttendancePayload | GradePayload;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPpurioConfig(academy_id?: string) {
  // 전역 설정 (site_settings)
  const { data: globalData } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'PPURIO_API_KEY', 'PPURIO_ACCOUNT', 'PPURIO_SENDER_NUMBER',
      'KAKAO_SENDER_KEY', 'KAKAO_TEMPLATE_ARRIVAL_ID',
      'KAKAO_TEMPLATE_DEPARTURE_ID', 'KAKAO_TEMPLATE_GRADE_ID',
    ]);
  const g: Record<string, string> = {};
  (globalData ?? []).forEach(row => { if (row.value) g[row.key] = row.value; });

  // 학원별 설정 (academy_config) — 전역보다 우선
  const a: Record<string, string> = {};
  if (academy_id) {
    const { data: ac } = await supabaseAdmin
      .from('academy_config')
      .select('ppurio_account, ppurio_api_key, ppurio_sender_number, kakao_sender_key, kakao_template_arrival, kakao_template_departure, kakao_template_grade')
      .eq('user_id', academy_id)
      .single();
    if (ac) {
      if (ac.ppurio_account)         a['PPURIO_ACCOUNT']              = ac.ppurio_account;
      if (ac.ppurio_api_key)         a['PPURIO_API_KEY']              = ac.ppurio_api_key;
      if (ac.ppurio_sender_number)   a['PPURIO_SENDER_NUMBER']        = ac.ppurio_sender_number;
      if (ac.kakao_sender_key)       a['KAKAO_SENDER_KEY']            = ac.kakao_sender_key;
      if (ac.kakao_template_arrival) a['KAKAO_TEMPLATE_ARRIVAL_ID']   = ac.kakao_template_arrival;
      if (ac.kakao_template_departure) a['KAKAO_TEMPLATE_DEPARTURE_ID'] = ac.kakao_template_departure;
      if (ac.kakao_template_grade)   a['KAKAO_TEMPLATE_GRADE_ID']     = ac.kakao_template_grade;
    }
  }

  return {
    apiKey:           a['PPURIO_API_KEY']              || g['PPURIO_API_KEY']              || process.env.PPURIO_API_KEY,
    account:          a['PPURIO_ACCOUNT']              || g['PPURIO_ACCOUNT']              || process.env.PPURIO_ACCOUNT,
    senderNumber:     a['PPURIO_SENDER_NUMBER']        || g['PPURIO_SENDER_NUMBER']        || process.env.PPURIO_SENDER_NUMBER,
    senderProfile:    a['KAKAO_SENDER_KEY']            || g['KAKAO_SENDER_KEY']            || process.env.KAKAO_SENDER_KEY,
    arrivalTplCode:   a['KAKAO_TEMPLATE_ARRIVAL_ID']   || g['KAKAO_TEMPLATE_ARRIVAL_ID']   || process.env.KAKAO_TEMPLATE_ARRIVAL_ID,
    departureTplCode: a['KAKAO_TEMPLATE_DEPARTURE_ID'] || g['KAKAO_TEMPLATE_DEPARTURE_ID'] || process.env.KAKAO_TEMPLATE_DEPARTURE_ID,
    gradeTplCode:     a['KAKAO_TEMPLATE_GRADE_ID']     || g['KAKAO_TEMPLATE_GRADE_ID']     || process.env.KAKAO_TEMPLATE_GRADE_ID,
  };
}

const PPURIO_BASE = process.env.PPURIO_PROXY_URL ?? 'http://49.247.137.90:3000';

async function getToken(account: string, apiKey: string): Promise<string> {
  const res = await fetch(`${PPURIO_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${account}:${apiKey}`).toString('base64')}`,
    },
  });
  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`);
  return data.token;
}

export async function sendPpurioSms(to: string, content: string, academy_id?: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getPpurioConfig(academy_id);

  if (!cfg.apiKey || !cfg.account) {
    return { ok: false, error: '뿌리오 설정이 없습니다.' };
  }
  if (!cfg.senderNumber) {
    return { ok: false, error: '뿌리오 SMS 발신번호(PPURIO_SENDER_NUMBER)가 설정되지 않았습니다.' };
  }

  const token = await getToken(cfg.account, cfg.apiKey);
  const byteLen = Buffer.byteLength(content, 'utf8');
  const messageType = byteLen <= 90 ? 'SMS' : 'LMS';

  const res = await fetch(`${PPURIO_BASE}/message`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account:       cfg.account,
      messageType,
      content,
      from:          cfg.senderNumber.replace(/-/g, ''),
      duplicateFlag: 'Y',
      targetCount:   1,
      targets:       [{ to: to.replace(/-/g, '') }],
      refKey:        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }),
  });

  const result = await res.json() as { code?: string; description?: string };
  console.log('[ppurio] SMS 응답:', JSON.stringify({ httpStatus: res.status, body: result }));

  if (result.code !== '1000') {
    return { ok: false, error: result.description || `code: ${result.code}` };
  }
  return { ok: true };
}

export async function sendAlimtalk(payload: AlimtalkPayload, academy_id?: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getPpurioConfig(academy_id);

  if (!cfg.apiKey || !cfg.account || !cfg.senderProfile) {
    return { ok: false, error: '알림톡 채널이 아직 설정되지 않았습니다. 슈퍼어드민 사이트 설정에서 설정해주세요.' };
  }

  let tplCode: string | undefined;
  if (payload.type === 'attendance') {
    tplCode = payload.status === '등원' ? cfg.arrivalTplCode : cfg.departureTplCode;
  } else {
    tplCode = cfg.gradeTplCode;
  }

  if (!tplCode) {
    const label = payload.type === 'attendance'
      ? (payload.status === '등원' ? '등원' : '하원')
      : '성적';
    return { ok: false, error: `${label} 알림톡 템플릿이 설정되지 않았습니다.` };
  }

  // attendance: var1=[*1*](학원명), var2=[*2*](날짜), name=[*이름*](학생명)
  // grade:      var1=[*1*](학원명), var2=[*2*](날짜), var3=[*3*](성적내역), name=[*이름*](학생명)
  const changeWord = payload.type === 'attendance'
    ? { var1: payload.academyName, var2: payload.date }
    : { var1: payload.academyName, var2: payload.date, var3: payload.content };

  const token = await getToken(cfg.account, cfg.apiKey);

  const res = await fetch(`${PPURIO_BASE}/kakao`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account:       cfg.account,
      messageType:   'ALT',
      senderProfile: cfg.senderProfile,
      templateCode:  tplCode,
      duplicateFlag: 'N',
      isResend:      'N',
      refKey:        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetCount:   1,
      targets: [
        {
          to:         payload.to.replace(/-/g, ''),
          name:       payload.studentName,
          changeWord,
        },
      ],
    }),
  });

  const result = await res.json() as { code?: string; description?: string };
  console.log('[ppurio] 응답:', JSON.stringify({ type: payload.type, httpStatus: res.status, body: result }));

  if (result.code !== '1000') {
    return { ok: false, error: result.description || `code: ${result.code}` };
  }
  return { ok: true };
}
