-- =============================================================
-- 실전변형(실제 생성 재시도) 로그 — 유형별 재시도 빈도를 추적해서
-- 콘단가 원가 계산에 재시도 마진을 반영하기 위한 테이블.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

create table if not exists generation_retry_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feature text not null,          -- 'exam_question' (실전변형). 추후 다른 기능 추가 대비해 텍스트로 둠.
  question_type text not null,    -- 'grammar', 'vocab_paraphrase' 등 실제 유형 키
  model text,                     -- 호출에 쓰인 모델명
  attempts integer not null,      -- 이번 생성에 몇 번 시도했는지 (1 = 첫 시도 성공)
  success boolean not null,       -- 최종적으로 문제 생성에 성공했는지
  academy_id uuid                 -- 어느 학원 요청이었는지 (선택적 참고용)
);

create index if not exists idx_generation_retry_log_type on generation_retry_log(feature, question_type);
create index if not exists idx_generation_retry_log_created on generation_retry_log(created_at desc);

-- service role(백엔드 API 라우트)로만 쓰고 읽으므로, 공개 정책은 두지 않고 기본 차단한다.
alter table generation_retry_log enable row level security;
