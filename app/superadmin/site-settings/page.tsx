'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

const SECTIONS = [
  {
    title: '개인정보 보호책임자 / 문의처',
    fields: [
      { key: 'company_name',           label: '법인명' },
      { key: 'company_address',        label: '사업장 소재지' },
      { key: 'privacy_manager_name',   label: '개인정보 보호 책임자' },
      { key: 'privacy_manager_phone',  label: '책임자 연락처' },
      { key: 'privacy_manager_email',  label: '책임자 이메일' },
    ],
  },
  {
    title: '무통장 입금 계좌 정보',
    fields: [
      { key: 'bank_name',     label: '은행명' },
      { key: 'bank_account',  label: '계좌번호' },
      { key: 'bank_holder',   label: '예금주' },
    ],
  },
  {
    title: '💬 카카오 알림톡 설정 (알리고)',
    fields: [
      { key: 'ALIGO_API_KEY',                 label: '알리고 API Key' },
      { key: 'ALIGO_USER_ID',                 label: '알리고 User ID' },
      { key: 'KAKAO_SENDER_KEY',              label: '카카오 발신프로파일 키 (senderkey)' },
      { key: 'KAKAO_TEMPLATE_ATTENDANCE_ID',  label: '출결 알림 템플릿 코드 (tpl_code)' },
      { key: 'KAKAO_TEMPLATE_GRADE_ID',       label: '성적 알림 템플릿 코드 (tpl_code)' },
    ],
  },
];

export default function SiteSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const load = async () => {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await client.from('site_settings').select('key, value');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        setValues(map);
      }
    };
    load();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/ico', 'image/x-icon', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setLogoMsg('PNG, JPG, ICO, SVG, WEBP 파일만 업로드 가능합니다.');
      return;
    }

    setLogoUploading(true);
    setLogoMsg('');

    const ext = file.name.split('.').pop();
    const path = `favicon.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('site-assets')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setLogoMsg(`업로드 실패: ${uploadError.message}`);
      setLogoUploading(false);
      return;
    }

    const { data: urlData } = supabaseClient.storage.from('site-assets').getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await fetch('/api/superadmin/site-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { site_logo_url: publicUrl } }),
    });

    setValues(prev => ({ ...prev, site_logo_url: publicUrl }));
    setLogoMsg('✅ 업로드 완료! 배포 후 반영됩니다.');
    setLogoUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/superadmin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: values }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-black text-white mb-1">사이트 설정</h1>
        <p className="text-slate-400 font-medium text-sm">개인정보처리방침 및 CON 충전 안내에 표시될 정보를 관리합니다.</p>
      </div>

      {/* 사이트 파비콘 */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-black text-white">🖼️ 사이트 파비콘 (탭 아이콘)</h2>
          <p className="text-xs text-slate-400 mt-1">브라우저 탭, 즐겨찾기에 표시되는 아이콘입니다. PNG 32×32 권장</p>
        </div>
        <div className="p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {values.site_logo_url ? (
              <Image src={values.site_logo_url} alt="파비콘 미리보기" width={48} height={48} className="object-contain" unoptimized />
            ) : (
              <span className="text-2xl text-slate-600">🖼️</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/x-icon,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className={`inline-block px-5 py-2.5 rounded-xl font-black text-sm cursor-pointer transition-all ${
                logoUploading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {logoUploading ? '업로드 중...' : '파일 선택 및 업로드'}
            </label>
            {logoMsg && (
              <p className={`text-xs font-bold mt-2 ${logoMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {logoMsg}
              </p>
            )}
            {values.site_logo_url && !logoMsg && (
              <p className="text-xs text-slate-500 mt-2 font-bold truncate max-w-sm">{values.site_logo_url}</p>
            )}
          </div>
        </div>
      </div>

      {SECTIONS.map(section => (
        <div key={section.title} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-base font-black text-white">{section.title}</h2>
          </div>
          <div className="p-6 space-y-5">
            {section.fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider">{f.label}</label>
                <input
                  type="text"
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white font-medium text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {saved && <p className="text-sm font-bold text-green-400">✅ 저장되었습니다</p>}
      </div>
    </div>
  );
}
