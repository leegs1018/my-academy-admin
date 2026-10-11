-- =============================================================
-- 1) 신규 가입자 온보딩 선택 화면 — 기존 학원은 모두 true로 백필해서
--    팝업이 다시 보이지 않게 하고, 신규 가입 시에만 명시적으로 false로 생성한다.
-- =============================================================
alter table academy_config add column if not exists onboarding_seen boolean not null default true;

-- =============================================================
-- 2) 가입 → 선택 → AI 체험 → 생성까지의 퍼널 이벤트 로그.
--    지문 원문·학생 개인정보 등 민감한 내용은 저장하지 않고, 이벤트명 + 가벼운
--    메타데이터(예: 어떤 유형을 선택했는지)만 기록한다.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================
create table if not exists events_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  event_name text not null,       -- signup_completed, onboarding_viewed, onboarding_selected,
                                   -- ai_page_viewed, passage_entered, generation_clicked,
                                   -- generation_completed, generation_failed, sample_passage_used 등
  metadata jsonb,                 -- 예: { "page": "ai-questions", "choice": "ai" }
  referrer_source text            -- 가입 시점 유입 경로 (네이버/인스타그램/직접 등). 없으면 null.
);

create index if not exists idx_events_log_user on events_log(user_id, created_at);
create index if not exists idx_events_log_event on events_log(event_name, created_at desc);

-- service role(백엔드 API 라우트)로만 쓰고 읽으므로, 공개 정책은 두지 않고 기본 차단한다.
alter table events_log enable row level security;
