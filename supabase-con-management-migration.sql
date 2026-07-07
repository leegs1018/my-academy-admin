-- =============================================================
-- CON 관리 전면 개선 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor 에서 붙여넣고 실행
-- =============================================================

-- 1. 추천인 코드 컬럼 추가 (각 원장님의 공유 가능한 고유 코드)
ALTER TABLE academy_config
  ADD COLUMN IF NOT EXISTS own_referral_code TEXT UNIQUE;

-- 2. 가입 CON 단가 (슈퍼어드민에서 수정 가능)
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES
  ('signup_bonus',          '신규 가입 기본 CON',          300, '가입 1회당',      true),
  ('signup_bonus_referral', '추천인 코드 입력 시 추가 CON', 400, '가입 1회당 추가', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 3. 실전 변형 문제 유형별 CON 단가
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES
  ('ai_type_topic_title',      '주제/제목 유형',          20, '1회당', true),
  ('ai_type_grammar',          '어법 유형',               20, '1회당', true),
  ('ai_type_vocab_paraphrase', '어휘 - 낱말 쓰임 유형',   20, '1회당', true),
  ('ai_type_vocab_blank',      '어휘 (a)(b) 빈칸 유형',   20, '1회당', true),
  ('ai_type_fill_blank',       '빈칸 추론 유형',           20, '1회당', true),
  ('ai_type_summary',          '요약문 완성 유형',         20, '1회당', true),
  ('ai_type_flow',             '흐름 유형',               20, '1회당', true),
  ('ai_type_phrase_meaning',   '어구 의미 추론 유형',      20, '1회당', true),
  ('ai_type_sentence_order',   '순서 배열 유형',           20, '1회당', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 4. 기존 ai_question_per_type 비활성화 (유형별로 대체됨)
UPDATE con_pricing SET is_active = false WHERE feature_key = 'ai_question_per_type';
