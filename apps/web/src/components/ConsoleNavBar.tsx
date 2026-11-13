"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createArchitecture, GITHUB_LOGIN_URL, listArchitectures, updateArchitecture } from "@/lib/api";
import { useCurrentUser, useLogout } from "@/lib/use-current-user";
import { UserMenu } from "./UserMenu";

const GITHUB_REPO_URL = "https://github.com/swtae0214/Nangman-ArcLab";
const README_URL = `${GITHUB_REPO_URL}/blob/main/README.md`;
const TUTORIAL_ARCHITECTURE_NAME = "ArcLab 튜토리얼";
const TUTORIAL_EMPTY_GRAPH = { nodes: [], edges: [] };

interface ConsoleNavBarProps {
  /**
   * "landing" = 비로그인 마케팅 홈(/). "dashboard" = /architectures.
   * 두 화면 모두 같은 로고/타이포지만 가운데 메뉴와 우측 버튼 내용이 달라서 variant로 가른다.
   */
  variant: "landing" | "dashboard";
}

/**
 * design_handoff_home_dashboard의 랜딩/대시보드 상단 네비게이션. "공유 링크"처럼 대응하는 화면이
 * 아직 없는 메뉴는 아예 빼뒀고, "문서"는 별도 문서 페이지 대신 GitHub README로 바로 연결한다.
 */
export function ConsoleNavBar({ variant }: ConsoleNavBarProps) {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [isStartingTutorial, setIsStartingTutorial] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => router.push("/") });
  };

  /**
   * 11단계: 매번 새 아키텍처를 만들면 "ArcLab 튜토리얼"이라는 같은 이름이 계속 쌓인다 — 아키텍처 이름이
   * 계정 안에서 유일해야 하는 것과도 맞지 않는다. 그래서 이미 만들어둔 "ArcLab 튜토리얼"이 있으면
   * 새로 만들지 않고 그 안의 그래프만 비운 뒤 다시 연다. 없을 때만 새로 만든다.
   */
  const handleStartTutorial = async () => {
    setIsStartingTutorial(true);
    try {
      const architectures = await listArchitectures();
      const existing = architectures.find((architecture) => architecture.name === TUTORIAL_ARCHITECTURE_NAME);
      if (existing) {
        await updateArchitecture(existing.id, { graph: TUTORIAL_EMPTY_GRAPH });
        router.push(`/architectures/${existing.id}?tutorial=1`);
      } else {
        const created = await createArchitecture({ name: TUTORIAL_ARCHITECTURE_NAME, graph: TUTORIAL_EMPTY_GRAPH });
        router.push(`/architectures/${created.id}?tutorial=1`);
      }
    } finally {
      setIsStartingTutorial(false);
    }
  };

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
          <a href={README_URL} target="_blank" rel="noreferrer" className="hover:text-console-accent-hover">
            문서
          </a>
          <button
            type="button"
            onClick={() => void handleStartTutorial()}
            disabled={isStartingTutorial}
            className="hover:text-console-accent-hover disabled:opacity-50"
          >
            {isStartingTutorial ? "준비 중..." : "튜토리얼"}
          </button>
        </nav>
      )}

      {variant === "landing" ? (
        user ? (
          <Link
            href="/architectures"
            className="rounded bg-console-accent px-5 py-2.5 font-sans text-[13px] font-bold text-console-bg hover:bg-console-accent-hover"
          >
            대시보드로 가기
          </Link>
        ) : (
          <a
            href={GITHUB_LOGIN_URL}
            className="rounded bg-console-accent px-5 py-2.5 font-sans text-[13px] font-bold text-console-bg hover:bg-console-accent-hover"
          >
            GitHub로 로그인
          </a>
        )
      ) : user ? (
        <UserMenu user={user} onLogout={handleLogout} isLoggingOut={logout.isPending} />
      ) : (
        <div className="h-8 w-8" />
      )}
    </div>
  );
}
