-- =============================================================
-- CON 단가 v2 마이그레이션
-- 지문분석 직접/모의고사 분리, 워크북 19종×2, 실전변형 모의고사 9종
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

-- 1. 지문분석 분리
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active) VALUES
  ('pdf_analysis_direct', '지문분석 - 직접 입력', 50, '1회당', true),
  ('pdf_analysis_mock',   '지문분석 - 모의고사',  50, '1회당', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 기존 pdf_analysis 비활성화
UPDATE con_pricing SET is_active = false WHERE feature_key = 'pdf_analysis';

-- 2. 워크북 직접 입력 19종
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active) VALUES
  ('wb_direct_vocab_choice',          '어휘 선택',            50, '1회당', true),
  ('wb_direct_vocab_fill',            '어휘 완성',            50, '1회당', true),
  ('wb_direct_grammar_choice',        '어법 선택',            50, '1회당', true),
  ('wb_direct_grammar_correct',       '어법 수정',            50, '1회당', true),
  ('wb_direct_grammar_correct_adv',   '어법 수정(상)',         50, '1회당', true),
  ('wb_direct_translation',           '해석하기',             50, '1회당', true),
  ('wb_direct_word_order',            '낱말 배열',            50, '1회당', true),
  ('wb_direct_english_writing',       '영작하기',             50, '1회당', true),
  ('wb_direct_passage_translation',   '본문 해석지',          50, '1회당', true),
  ('wb_direct_paragraph_order',       '문단 배열',            50, '1회당', true),
  ('wb_direct_sentence_insertion',    '문장 삽입',            50, '1회당', true),
  ('wb_direct_suneung_vocab_right',   '적절한 어휘',          50, '1회당', true),
  ('wb_direct_suneung_vocab_wrong',   '부적절한 어휘',        50, '1회당', true),
  ('wb_direct_suneung_grammar_right', '맞는 어법',            50, '1회당', true),
  ('wb_direct_suneung_grammar_wrong', '틀린 어법',            50, '1회당', true),
  ('wb_direct_combo_vocab_grammar',   '어휘+어법',            50, '1회당', true),
  ('wb_direct_combo_vocab_fill',      '어휘+문장완성',        50, '1회당', true),
  ('wb_direct_combo_grammar_order',   '어법+문장배열',        50, '1회당', true),
  ('wb_direct_combo_grammar_insert',  '어법+문장삽입',        50, '1회당', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 3. 워크북 모의고사 19종
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active) VALUES
  ('wb_mock_vocab_choice',          '어휘 선택',            50, '1회당', true),
  ('wb_mock_vocab_fill',            '어휘 완성',            50, '1회당', true),
  ('wb_mock_grammar_choice',        '어법 선택',            50, '1회당', true),
  ('wb_mock_grammar_correct',       '어법 수정',            50, '1회당', true),
  ('wb_mock_grammar_correct_adv',   '어법 수정(상)',         50, '1회당', true),
  ('wb_mock_translation',           '해석하기',             50, '1회당', true),
  ('wb_mock_word_order',            '낱말 배열',            50, '1회당', true),
  ('wb_mock_english_writing',       '영작하기',             50, '1회당', true),
  ('wb_mock_passage_translation',   '본문 해석지',          50, '1회당', true),
  ('wb_mock_paragraph_order',       '문단 배열',            50, '1회당', true),
  ('wb_mock_sentence_insertion',    '문장 삽입',            50, '1회당', true),
  ('wb_mock_suneung_vocab_right',   '적절한 어휘',          50, '1회당', true),
  ('wb_mock_suneung_vocab_wrong',   '부적절한 어휘',        50, '1회당', true),
  ('wb_mock_suneung_grammar_right', '맞는 어법',            50, '1회당', true),
  ('wb_mock_suneung_grammar_wrong', '틀린 어법',            50, '1회당', true),
  ('wb_mock_combo_vocab_grammar',   '어휘+어법',            50, '1회당', true),
  ('wb_mock_combo_vocab_fill',      '어휘+문장완성',        50, '1회당', true),
  ('wb_mock_combo_grammar_order',   '어법+문장배열',        50, '1회당', true),
  ('wb_mock_combo_grammar_insert',  '어법+문장삽입',        50, '1회당', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 기존 vocab_choice, mock_workbook 비활성화
UPDATE con_pricing SET is_active = false WHERE feature_key IN ('vocab_choice', 'mock_workbook');

-- 4. 실전 변형 문제 모의고사 9종
INSERT INTO con_pricing (feature_key, feature_name, cost_per_use, unit_description, is_active) VALUES
  ('mock_ai_type_topic_title',      '주제/제목 유형',          20, '1회당', true),
  ('mock_ai_type_grammar',          '어법 유형',               20, '1회당', true),
  ('mock_ai_type_vocab_paraphrase', '어휘 - 낱말 쓰임 유형',   20, '1회당', true),
  ('mock_ai_type_vocab_blank',      '어휘 (a)(b) 빈칸 유형',   20, '1회당', true),
  ('mock_ai_type_fill_blank',       '빈칸 추론 유형',           20, '1회당', true),
  ('mock_ai_type_summary',          '요약문 완성 유형',         20, '1회당', true),
  ('mock_ai_type_flow',             '흐름 유형',               20, '1회당', true),
  ('mock_ai_type_phrase_meaning',   '어구 의미 추론 유형',      20, '1회당', true),
  ('mock_ai_type_sentence_order',   '순서 배열 유형',           20, '1회당', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 기존 mock_exam_question_per_type 비활성화
UPDATE con_pricing SET is_active = false WHERE feature_key = 'mock_exam_question_per_type';
