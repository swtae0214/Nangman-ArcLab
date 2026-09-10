import Link from "next/link";

const GITHUB_REPO_URL = "https://github.com/swtae0214/Nangman-ArcLab";

interface ConsoleNavBarProps {
  /**
   * "landing" = 비로그인 마케팅 홈(/). "dashboard" = /architectures.
   * 두 화면 모두 같은 로고/타이포지만 가운데 메뉴와 우측 버튼 내용이 달라서 variant로 가른다.
   */
  variant: "landing" | "dashboard";
}

/**
 * design_handoff_home_dashboard의 랜딩/대시보드 상단 네비게이션. 디자인엔 있지만 대응하는
 * 실제 화면이 없는 메뉴(대시보드의 "공유 링크"/"문서")는 없는 페이지로 링크를 걸지 않고
 * 비활성 텍스트로만 둔다 — 새 페이지를 임의로 만들지 않기 위해서다.
 */
export function ConsoleNavBar({ variant }: ConsoleNavBarProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-console-accent/15 bg-console-bg px-10 py-5 ${
        variant === "dashboard" ? "sticky top-0 z-10" : ""
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-console-accent shadow-[0_0_8px_#5aff9e]" />
        <span className="font-jetbrains text-[13px] font-bold tracking-wide text-console-fg">ARCLAB.NANGMAN.CLOUD</span>
      </Link>

      {variant === "landing" ? (
        <nav className="flex gap-7 font-sans text-[13px] font-medium text-console-muted">
          <a href="#features" className="hover:text-console-accent-hover">
            기능
          </a>
          <a href="#rules" className="hover:text-console-accent-hover">
            검증 규칙
          </a>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-console-accent-hover">
            GitHub
          </a>
        </nav>
      ) : (
        <nav className="flex gap-7 font-sans text-[13px] font-medium text-console-muted">
          <Link href="/architectures" className="font-bold text-console-accent">
            내 아키텍처
          </Link>
          <span className="cursor-default text-console-muted/50" title="아직 준비되지 않은 화면이에요">
            공유 링크
          </span>
          <span className="cursor-default text-console-muted/50" title="아직 준비되지 않은 화면이에요">
            문서
          </span>
        </nav>
      )}

      {variant === "landing" ? (
        <Link
          href="/architectures"
          className="rounded bg-console-accent px-5 py-2.5 font-sans text-[13px] font-bold text-console-bg hover:bg-console-accent-hover"
        >
          로그인 / 시작하기
        </Link>
      ) : (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-console-accent font-sans text-[13px] font-bold text-console-bg"
          title="ArchLab (로그인 없이 브라우저 세션으로 동작해요)"
        >
          A
        </div>
      )}
    </div>
  );
}
