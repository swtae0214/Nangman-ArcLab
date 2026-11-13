-- 같은 계정 안에서 같은 이름의 아키텍처를 또 만들 수 없게 막는다.
-- (userId, name) 유일성 제약이 userId만 거는 조회도 그대로 커버해서, 기존 단일 컬럼 인덱스는 뺀다.
DROP INDEX "architectures_user_id_idx";
CREATE UNIQUE INDEX "architectures_user_id_name_key" ON "architectures"("user_id", "name");
