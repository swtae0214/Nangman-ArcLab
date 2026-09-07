import { defineConfig, devices } from "@playwright/test";

/**
 * 8주차: 핵심 플로우 E2E 테스트 설정.
 * dev 서버(웹 3000, API 4000)와 Docker Postgres가 이미 떠 있으면 그걸 그대로 재사용하고,
 * 안 떠 있으면 이 설정이 직접 띄운다 (reuseExistingServer).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    // 주의: Next.js dev 서버(Turbopack)는 127.0.0.1로 오는 정적/HMR 자산 요청을 origin 검증에서
    // 막아 403을 내려준다(허용 오리진 기본값이 localhost) — 반드시 localhost로 접속해야 한다.
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @nangman/api start:dev",
      url: "http://localhost:4000/api/v1/architectures",
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @nangman/web dev",
      url: "http://localhost:3000/architectures",
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
