-- =============================================================
-- 긴급 수정: supabase-revenue-tracking-migration.sql에서 deduct_con/charge_con을
-- CREATE OR REPLACE 했는데, 파라미터 "개수"가 바뀌면 Postgres는 기존 함수를
-- 교체하지 않고 별도의 오버로드 함수를 새로 만든다. 그 결과 DB에 같은 이름의
-- 함수가 2개씩 남아서, 기존 파라미터만 보내는 모든 호출(워크북/실전변형/지문분석/
-- SMS/알림톡/키오스크 등 CON을 쓰는 모든 기능)이 "어느 함수를 호출할지 모르겠다"는
-- 오류(PGRST203)로 실패하고 있었다.
--
-- 옛날 버전(파라미터 4개)을 명시적으로 삭제해서 함수를 각각 1개씩만 남긴다.
-- 실행: Supabase Dashboard > SQL Editor (최대한 빨리)
-- =============================================================

drop function if exists deduct_con(uuid, integer, text, text);
drop function if exists charge_con(uuid, integer, text, text);
