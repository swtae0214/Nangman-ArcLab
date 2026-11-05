-- GitHub 로그인이 필수가 되면서 owner_token(익명 세션 쿠키) 기반 소유권 체계가 더 이상 쓰이지 않는다.
-- 남아있던 레코드는 이미 수동으로 해당 GitHub 계정(userId)으로 옮겨뒀다.
DROP INDEX IF EXISTS "architectures_owner_token_idx";
ALTER TABLE "architectures" DROP COLUMN IF EXISTS "owner_token";
