-- =============================================================
-- 추천인 보상 CON 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

-- 추천인 보상 단가 (코드를 제공한 사람이 받는 CON)
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active)
VALUES ('referral_reward', '추천인 보상 CON', 100, '추천 성공 1회당', true)
ON CONFLICT (feature_key) DO NOTHING;
