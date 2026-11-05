import { expect, test, type Page } from "@playwright/test";
import { signInAsTestUser } from "./test-auth";

/**
 * 8주차: 핵심 플로우 E2E 테스트.
 * "아키텍처 생성 → 컴포넌트 배치/연결 → 정적 검증 → 시뮬레이션 실행 → 공유 링크 발급 →
 *  익명 사용자의 읽기 전용 조회 → 공유 해제 → 삭제"까지, 실제 서비스 사용 순서를 그대로 따라간다.
 *
 * 팔레트 → 캔버스 드래그는 브라우저 네이티브 HTML5 Drag&Drop(dataTransfer 기반)이라
 * Playwright의 기본 dragTo()로는 재현이 안 돼서, DragEvent를 직접 만들어 dispatch한다.
 */
async function dragComponentOntoCanvas(page: Page, label: string, offsetX: number, offsetY: number) {
  await page.evaluate(
    ({ label, offsetX, offsetY }) => {
      // 팔레트 버튼의 접근성 이름에는 AWS 아이콘 SVG의 title(예: "Icon-Architecture/48/...")도 섞여 들어오므로
      // 정확히 일치가 아니라 라벨 텍스트를 담은 <span>이 있는 버튼을 찾는다.
      const buttons = Array.from(document.querySelectorAll("aside button"));
      const source = buttons.find((button) =>
        Array.from(button.querySelectorAll("span")).some((span) => span.textContent?.trim() === label),
      );
      const pane = document.querySelector(".react-flow__pane");
      if (!source || !pane) {
        throw new Error(`드래그 소스 또는 캔버스를 찾지 못했습니다: ${label}`);
      }

      const rect = pane.getBoundingClientRect();
      const clientX = rect.left + offsetX;
      const clientY = rect.top + offsetY;
      const dataTransfer = new DataTransfer();

      const fire = (target: Element, type: string) => {
        target.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer, clientX, clientY }),
        );
      };

      fire(source, "dragstart");
      fire(pane, "dragenter");
      fire(pane, "dragover");
      fire(pane, "drop");
      fire(source, "dragend");
    },
    { label, offsetX, offsetY },
  );
}

/** React Flow 커스텀 노드의 source/target 핸들을 마우스로 이어서 엣지를 만든다 (포인터 기반이라 실제 마우스 시뮬레이션으로 동작). */
async function connectNodes(page: Page, sourceLabel: string, targetLabel: string) {
  const sourceHandle = page.locator(".react-flow__node").filter({ hasText: sourceLabel }).locator(".react-flow__handle-bottom");
  const targetHandle = page.locator(".react-flow__node").filter({ hasText: targetLabel }).locator(".react-flow__handle-top");

  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("연결 핸들의 위치를 가져오지 못했습니다.");
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100); // React Flow가 connection-line 상태로 전환할 시간을 준다
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test("핵심 플로우: 생성 → 배치/연결 → 검증 → 시뮬레이션 → 공유 → 읽기전용 조회 → 해제 → 삭제", async ({ page, context }) => {
  // 깃헙 로그인이 필수라, 테스트 전용 계정으로 로그인된 상태를 먼저 만들어둔다 (test-auth.ts 참고).
  const testUser = await signInAsTestUser(context);
  const architectureName = `E2E 테스트 ${Date.now()}`;

  try {
    // 1) 목록 페이지에서 아키텍처 생성 (Turbopack 첫 컴파일/첫 쿼리가 끝날 때까지 먼저 기다린다)
    await page.goto("/architectures");
    await expect(page.getByText("불러오는 중...")).toHaveCount(0);
    await page.getByPlaceholder("새 아키텍처 이름").fill(architectureName);
    await page.getByRole("button", { name: "+ 새 아키텍처 시작하기" }).click();
    await page.waitForURL(/\/architectures\/[0-9a-f-]{36}$/);
    await expect(page.getByText("핵심 인프라")).toBeVisible(); // 팔레트가 실제로 마운트될 때까지 대기

    // 2) 캔버스에 로드밸런서 + 웹 서버 배치 (웹 서버 카드는 프리셋 선택 UI 때문에 세로로 길어서,
    //    핸들끼리 겹치지 않도록 충분히 간격을 둔다)
    await dragComponentOntoCanvas(page, "로드밸런서", 250, 100);
    await dragComponentOntoCanvas(page, "웹 서버 (EC2)", 250, 500);
    await expect(page.locator(".react-flow__node").filter({ hasText: "로드밸런서" })).toBeVisible();
    await expect(page.locator(".react-flow__node").filter({ hasText: "웹 서버 (EC2)" })).toBeVisible();

    // 3) 두 노드를 연결 (로드밸런서 → 웹 서버)
    await connectNodes(page, "로드밸런서", "웹 서버 (EC2)");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // 자동저장은 2초 디바운스라, 저장이 끝나기 전에 검증/공유를 누르면 서버에 저장된(구) 그래프를 보게 된다.
    // "저장됨"이 뜰 때까지 기다려서 지금 캔버스 상태가 실제로 DB에 반영된 뒤에 다음 단계로 넘어간다.
    await expect(page.getByText("저장됨")).toBeVisible({ timeout: 10_000 });

    // 4) 정적 검증 실행 — ASG 없이 배치한 웹 서버 1대는 ASG-001(웹 서버 Auto Scaling 여부) 규칙에 걸려야 한다
    await page.getByRole("button", { name: /검증하기|검증 중/ }).click();
    await expect(page.getByText("웹 서버 계층의 Auto Scaling 여부")).toBeVisible();

    // 5) 시뮬레이션 탭으로 이동해 기본값 그대로 실행
    await page.getByRole("button", { name: "시뮬레이션", exact: true }).click();
    await page.getByRole("button", { name: /시뮬레이션 실행|실행 중/ }).click();
    await expect(page.getByText(/추정 가용성/)).toBeVisible();

    // 6) 공유 링크 발급
    await page.getByRole("button", { name: "공유", exact: true }).click();
    const shareUrlInput = page.locator('input[readonly]');
    await expect(shareUrlInput).toBeVisible();
    const shareUrl = await shareUrlInput.inputValue();
    expect(shareUrl).toMatch(/\/shared\/[0-9a-f-]{36}$/);

    // 7) 쿠키 없는 새 컨텍스트(익명 방문자)로 공유 링크 접속 — 읽기 전용이어야 함
    const sharedRelativeUrl = new URL(shareUrl).pathname;
    const anonymousContext = await context.browser()!.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(sharedRelativeUrl);
    await expect(anonymousPage.getByText("읽기 전용 공유 링크")).toBeVisible();
    await expect(anonymousPage.locator(".react-flow__node").filter({ hasText: "로드밸런서" })).toBeVisible();
    await expect(anonymousPage.locator("aside")).toHaveCount(0); // 컴포넌트 팔레트(aside)는 읽기 전용 화면엔 아예 렌더되지 않는다
    await anonymousContext.close();

    // 8) 공유 해제
    await page.getByRole("button", { name: "공유 해제" }).click();
    await expect(page.getByRole("button", { name: "공유", exact: true })).toBeVisible();

    // 9) 목록(대시보드)으로 돌아가 삭제 — 삭제 버튼은 카드에 마우스를 올려야 보이고,
    //    누르면 되돌릴 수 없다는 확인창이 한 번 더 뜬다.
    await page.goto("/architectures");
    const card = page.locator(".group").filter({ hasText: architectureName });
    await expect(card).toBeVisible();
    await card.hover();
    await card.getByRole("button", { name: "삭제" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText("복구할 수 없어요")).toBeVisible();
    await confirmDialog.getByRole("button", { name: "삭제" }).click();
    await expect(page.locator(".group").filter({ hasText: architectureName })).toHaveCount(0);
  } finally {
    // 테스트 계정/아키텍처가 DB에 안 남도록 항상 정리한다 (테스트 중간에 실패해도 실행됨).
    await testUser.cleanup();
  }
});
