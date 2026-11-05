import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";

const SESSION_COOKIE = "archlab_session";
const DB_CONTAINER = "nangman-archlab-db-1";

/**
 * 실제 GitHub OAuth 로그인은 e2e에서 자동화할 수 없다(계정/2FA가 필요하고, 자동화 탐지로 막히기도
 * 쉽다). 대신 테스트용 User를 DB에 직접 꽂아 넣고, apps/api/src/common/guards/auth.guard.ts가
 * 신뢰하는 서명된 세션 쿠키(archlab_session)를 똑같은 방식(cookie-signature: HMAC-SHA256 + base64)
 * 으로 직접 만들어 브라우저 컨텍스트에 주입한다 — 인증 가드 자체는 실제 코드 그대로 통과시킨다.
 */
function readCookieSecret(): string {
  const envPath = path.resolve(__dirname, "../apps/api/.env");
  const content = readFileSync(envPath, "utf8");
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith("COOKIE_SECRET="));
  if (!line) {
    throw new Error(`apps/api/.env에서 COOKIE_SECRET을 찾지 못했습니다 (${envPath}).`);
  }
  return line.slice("COOKIE_SECRET=".length).trim();
}

function signSessionCookie(userId: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(userId).digest("base64").replace(/=+$/, "");
  return `s:${userId}.${hmac}`;
}

function runPsql(sql: string): void {
  execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "archlab", "-d", "archlab", "-c", sql], {
    stdio: "pipe",
  });
}

export interface TestUser {
  userId: string;
  cleanup: () => Promise<void>;
}

/** 테스트 전용 User를 만들고, 그 사용자로 로그인된 것처럼 세션 쿠키를 context에 심어준다. */
export async function signInAsTestUser(context: BrowserContext): Promise<TestUser> {
  const userId = randomUUID();
  const githubId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  runPsql(`INSERT INTO users (id, github_id, username) VALUES ('${userId}', '${githubId}', 'e2e-test-user');`);

  const secret = readCookieSecret();
  const signedValue = signSessionCookie(userId, secret);

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: encodeURIComponent(signedValue),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return {
    userId,
    // Architecture.userId가 onDelete: Cascade라, user를 지우면 테스트 중 만든 아키텍처도 같이 정리된다.
    cleanup: async () => {
      runPsql(`DELETE FROM users WHERE id = '${userId}';`);
    },
  };
}
