-- =============================================================
-- 워크북 "지문 해석지" 유형에서 동반의어표를 별도 유형으로 분리.
-- 기존 wb_direct_passage_translation / wb_mock_passage_translation 단가는
-- 그대로 유지되고, 새 유형(wb_direct_vocab_syn_ant / wb_mock_vocab_syn_ant)만 추가한다.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active) VALUES
  ('wb_direct_vocab_syn_ant', '동반의어표', 50, '1회당', true),
  ('wb_mock_vocab_syn_ant',   '동반의어표', 50, '1회당', true)
ON CONFLICT (feature_key) DO NOTHING;
