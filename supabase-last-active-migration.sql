-- =============================================================
-- 수퍼어드민 학원 관리의 "마지막 접속"이 Supabase Auth의 last_sign_in_at만
-- 참고해서, 로그인 세션이 길게 유지되는 사용자(재로그인 없이 계속 사용)의
-- 실제 최근 활동을 못 잡는 문제를 해결하기 위한 컬럼.
-- ClientLayout이 /admin 하위 페이지를 열 때마다(너무 잦은 쓰기는 클라이언트에서
-- 쓰로틀링) 이 값을 갱신한다.
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================================

alter table academy_config add column if not exists last_active_at timestamptz;
create index if not exists idx_academy_config_last_active on academy_config(last_active_at desc);
