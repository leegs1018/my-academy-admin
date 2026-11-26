-- =============================================================
-- 실전변형 "내용 일치"/"내용 불일치" 유형 단가 등록.
-- 문제: con_pricing에 해당 유형 가격이 없으면, 실전변형 페이지가
--       "슈퍼어드민이 OFF한 유형"으로 간주해 기본 목록에서 숨겨버림.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

insert into con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
values
  ('ai_type_content_match',        '내용 일치 유형',   15, '1회당', true),
  ('ai_type_content_mismatch',     '내용 불일치 유형', 15, '1회당', true),
  ('mock_ai_type_content_match',   '내용 일치 유형',   15, '1회당', true),
  ('mock_ai_type_content_mismatch','내용 불일치 유형', 15, '1회당', true)
on conflict (feature_key) do update set
  is_active = excluded.is_active;
