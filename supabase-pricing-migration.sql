-- CON 단가 세분화 마이그레이션
-- Supabase SQL Editor에서 실행

-- 1. 실전변형 문제: 유형당 20 CON (기존 ai_question 비활성화)
UPDATE con_pricing SET is_active = false WHERE feature_key = 'ai_question';

INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES ('ai_question_per_type', '실전변형 문제 (유형당)', 20, '유형 1개당')
ON CONFLICT (feature_key) DO UPDATE
  SET feature_name = EXCLUDED.feature_name,
      cost_per_use = EXCLUDED.cost_per_use,
      unit_description = EXCLUDED.unit_description,
      is_active = true,
      updated_at = now();

-- 2. 지문분석 툴/워크북: 50 CON
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES ('pdf_analysis', '지문분석 툴 / 워크북', 50, '1회 분석당')
ON CONFLICT (feature_key) DO UPDATE
  SET feature_name = EXCLUDED.feature_name,
      cost_per_use = EXCLUDED.cost_per_use,
      unit_description = EXCLUDED.unit_description,
      is_active = true,
      updated_at = now();

-- 3. SMS 단문: 2 CON (기존 sms 키 업데이트)
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES ('sms', 'SMS 문자 (단문)', 2, '건당')
ON CONFLICT (feature_key) DO UPDATE
  SET feature_name = EXCLUDED.feature_name,
      cost_per_use = EXCLUDED.cost_per_use,
      unit_description = EXCLUDED.unit_description,
      is_active = true,
      updated_at = now();

-- 4. LMS 장문: 4 CON (신규)
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES ('lms', 'LMS 문자 (장문)', 4, '건당')
ON CONFLICT (feature_key) DO UPDATE
  SET feature_name = EXCLUDED.feature_name,
      cost_per_use = EXCLUDED.cost_per_use,
      unit_description = EXCLUDED.unit_description,
      is_active = true,
      updated_at = now();

-- 확인
SELECT feature_key, feature_name, cost_per_use, is_active FROM con_pricing ORDER BY feature_key;
