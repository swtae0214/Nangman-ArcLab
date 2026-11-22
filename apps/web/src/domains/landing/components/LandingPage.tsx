"use client";

import type { CurrentUser } from "@nangman/shared-types";
import type { ReactNode } from "react";
import Link from "next/link";
import { ConsoleNavBar } from "@/components/ConsoleNavBar";
import { GITHUB_LOGIN_URL } from "@/lib/api";
import { AuthErrorBanner } from "./AuthErrorBanner";
import { useCurrentUser } from "@/lib/use-current-user";
import { useValidationRuleCatalog } from "@/lib/use-catalog";
import {
  SEVERITY_BADGE_BG_STYLE,
  SEVERITY_BORDER_STYLE,
  SEVERITY_ICON,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_TEXT_CLASS,
} from "@/lib/severity-colors";

const GITHUB_REPO_URL = "https://github.com/swtae0214/Nangman-ArcLab";
const README_URL = `${GITHUB_REPO_URL}/blob/main/README.md`;

/** 로그인 여부에 따라 "캔버스 시작하기"(기존 세션) 또는 "GitHub로 시작하기"(로그인 화면 이동)로 바뀌는 CTA. */
function StartCta({ user }: { user: CurrentUser | null | undefined }) {
  if (user) {
    return (
      <Link
        href="/architectures"
        className="rounded bg-console-accent px-6 py-3.5 text-sm font-bold text-console-bg hover:bg-console-accent-hover"
      >
        캔버스 시작하기 →
      </Link>
    );
  }
  return (
    <a
      href={GITHUB_LOGIN_URL}
      className="rounded bg-console-accent px-6 py-3.5 text-sm font-bold text-console-bg hover:bg-console-accent-hover"
    >
      GitHub로 시작하기 →
    </a>
  );
}

const FEATURES = [
  {
    step: "01",
    label: "CANVAS",
    title: "아키텍처 캔버스",
    description:
      "로드밸런서, 웹 서버, DB, 캐시, CDN을 끌어다 놓고 Auto Scaling, Multi-AZ, Multi-Region으로 묶어요.",
  },
  {
    step: "02",
    label: "STATIC CHECK",
    title: "정적 검증",
    description: "SPOF와 이중화 누락을 5가지 규칙으로 바로 찾아서, 문제가 있는 요소를 캔버스에 표시해요.",
  },
  {
    step: "03",
    label: "SIMULATION",
    title: "시뮬레이션",
    description: "평상시와 장애 상황에서 지연시간, 처리량, 추정 가용성이 어떻게 달라지는지 계산해요.",
  },
];

/** 샘플 다이어그램의 노드 하나(로드밸런서, 웹 서버 등)를 그리는 작은 박스. */
function DiagramNode({
  label,
  sub,
  critical = false,
  muted = false,
}: {
  label: string;
  sub: string;
  critical?: boolean;
  muted?: boolean;
}) {
  const toneClass = critical
    ? "border-console-critical text-console-critical"
    : muted
      ? "border-dashed border-console-accent/35 text-console-accent/50"
      : "border-console-accent text-console-accent";
  return (
    <div
      className={`flex w-[76px] flex-col items-center justify-center gap-0.5 rounded border px-1.5 py-1.5 text-center font-jetbrains text-[10px] font-semibold leading-tight ${toneClass}`}
    >
      <span>{label}</span>
      <span className="text-[8.5px] font-normal opacity-70">{sub}</span>
    </div>
  );
}

/** VPC / Public Subnet / Auto Scaling처럼, 노드 여러 개를 점선 테두리로 묶어서 이름표를 붙이는 그룹 박스. */
function DiagramGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded border border-dashed border-console-accent/25 px-3 pt-4 pb-2.5 ${className ?? ""}`}>
      <span className="absolute -top-2 left-2 bg-console-panel px-1 font-jetbrains text-[8.5px] font-semibold text-console-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

/** 노드/그룹 사이를 잇는 짧은 수평 연결선. */
function DiagramConnector() {
  return <div className="h-0.5 w-5 flex-shrink-0 self-center bg-console-accent/40" aria-hidden />;
}

export function LandingPage() {
  const { data: rulesData } = useValidationRuleCatalog();
  const { data: user } = useCurrentUser();
  const rules = [...(rulesData ?? [])].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <div className="min-h-screen bg-console-bg font-noto-kr text-console-fg">
      <div className="mx-auto max-w-[1360px]">
        <ConsoleNavBar variant="landing" />
        <AuthErrorBanner />

        <section className="px-10 pt-16 pb-12">
          <div className="mb-3.5 font-jetbrains text-xs font-semibold text-console-accent">
            ● EXAMPLE · 샘플 3-Tier 아키텍처
          </div>
          <h1 className="mb-[18px] max-w-[720px] text-[44px] leading-[1.22] font-black text-white">
            당신의 설계,
            <br />
            지금 실시간으로 검증됩니다
          </h1>
          <p className="mb-3 max-w-[560px] text-base leading-[1.75] text-console-subtle">
            AWS 구성도를 그리면 한 곳이 멈추면 전체가 멈추는 곳과 이중화가 빠진 곳을 바로 찾아줘요.
            <br />
            트래픽이 늘거나 장애가 났을 때 어떻게 되는지도 미리 실험해 볼 수 있어요.
          </p>
          <div className="mb-8 font-jetbrains text-xs text-console-muted">
            SPOF 검사 · Well-Architected Reliability 기반 규칙 · M/M/c 큐잉 시뮬레이션
          </div>
          <div className="mb-11 flex gap-3">
            <StartCta user={user} />
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-console-accent/35 px-6 py-3.5 font-jetbrains text-sm font-semibold text-console-fg hover:border-console-accent"
            >
              GitHub 보기
            </a>
          </div>

          <div className="overflow-hidden rounded-md border border-console-accent/20 bg-console-panel">
            <div className="flex items-center justify-between border-b border-console-accent/15 px-6 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-white">샘플 3-Tier 아키텍처</span>
                <span className="flex items-center gap-1 rounded bg-console-accent/15 px-2 py-0.5 font-jetbrains text-[10.5px] font-semibold text-console-accent">
                  ✓ 통과
                </span>
              </div>
              <span className="font-jetbrains text-[10.5px] font-semibold text-console-muted">예시 화면</span>
            </div>

            <div className="grid grid-cols-[1.7fr_1fr]">
              <div className="flex items-center overflow-x-auto p-7">
                <div className="flex items-stretch gap-3">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <DiagramNode label="사용자" sub="User" />
                  </div>
                  <DiagramConnector />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <DiagramNode label="CDN" sub="CloudFront" />
                  </div>
                  <DiagramConnector />
                  <DiagramGroup label="VPC" className="flex items-stretch gap-4">
                    <DiagramGroup label="Public Subnet" className="flex items-center">
                      <div className="flex flex-col gap-2.5">
                        <DiagramNode label="로드밸런서" sub="#1" />
                        <DiagramNode label="로드밸런서" sub="#2" />
                      </div>
                    </DiagramGroup>
                    <DiagramConnector />
                    <DiagramGroup label="Private Subnet" className="flex items-center">
                      <DiagramGroup label="Auto Scaling" className="flex items-center">
                        <div className="flex flex-col gap-2.5">
                          <DiagramNode label="웹 서버" sub="EC2 #1" />
                          <DiagramNode label="웹 서버" sub="EC2 #2" />
                        </div>
                      </DiagramGroup>
                    </DiagramGroup>
                    <DiagramConnector />
                    <DiagramGroup label="Multi-AZ" className="flex items-center">
                      <div className="flex flex-col gap-2 pl-1">
                        <DiagramNode label="캐시" sub="ElastiCache" />
                        <DiagramNode label="DB Primary" sub="RDS" />
                        <div className="pl-1 font-jetbrains text-[8px] text-console-muted">↓ 복제</div>
                        <DiagramNode label="DB Replica" sub="RDS" muted />
                      </div>
                    </DiagramGroup>
                  </DiagramGroup>
                </div>
              </div>

              <div className="flex flex-col border-l border-console-accent/15">
                <div className="p-5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-console-accent/15 text-[11px] text-console-accent">
                      ✓
                    </span>
                    <span className="text-sm font-bold text-white">검증 통과</span>
                  </div>
                  <p className="mb-4 text-xs text-console-subtle">5개 규칙을 모두 충족했어요</p>
                  <ul className="flex flex-col gap-2.5">
                    {rules.map((rule) => (
                      <li key={rule.code} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-console-fg">
                          <span className="text-console-accent">✓</span> {rule.name}
                        </span>
                        <span
                          style={{ backgroundColor: SEVERITY_BADGE_BG_STYLE[rule.severity] }}
                          className={`flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-jetbrains text-[9.5px] font-semibold ${SEVERITY_TEXT_CLASS[rule.severity]}`}
                        >
                          {SEVERITY_ICON[rule.severity]} {SEVERITY_LABEL[rule.severity]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto border-t border-console-accent/15 p-5">
                  <div className="mb-2.5 font-jetbrains text-[10px] font-semibold text-console-muted">
                    SIMULATION · 예시 값
                  </div>
                  <div className="flex items-center justify-between py-1 text-xs">
                    <span className="text-console-muted">추정 가용성</span>
                    <span className="font-jetbrains text-sm font-bold text-console-accent">99.94%</span>
                  </div>
                  <div className="flex items-center justify-between py-1 text-xs">
                    <span className="text-console-muted">평균 지연시간</span>
                    <span className="font-jetbrains text-sm font-bold text-white">184ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="grid grid-cols-3 gap-px border-y border-console-accent/15 bg-console-accent/12">
          {FEATURES.map((feature) => (
            <div key={feature.step} className="bg-console-bg px-[34px] py-8">
              <div className="mb-2.5 font-jetbrains text-xs font-bold text-console-accent">
                {feature.step} · {feature.label}
              </div>
              <div className="mb-2 text-[17px] font-bold text-white">{feature.title}</div>
              <div className="text-[13px] leading-[1.65] text-console-subtle">{feature.description}</div>
            </div>
          ))}
        </section>

        <section id="rules" className="px-10 pt-10 pb-6">
          <div className="mb-1 font-jetbrains text-xs font-bold tracking-wide text-console-accent">
            STATIC VALIDATION RULES
          </div>
          <h2 className="mb-1.5 text-2xl font-black text-white">검증 규칙 5가지</h2>
          <p className="mb-7 text-xs text-console-subtle">중요도는 색과 모양으로 함께 표시돼요.</p>
          <div className="grid grid-cols-3 gap-3.5">
            {rules.map((rule) => (
              <div
                key={rule.code}
                style={{ borderColor: SEVERITY_BORDER_STYLE[rule.severity] }}
                className="rounded-md border bg-console-panel p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    style={{ backgroundColor: SEVERITY_BADGE_BG_STYLE[rule.severity] }}
                    className={`flex items-center gap-1 rounded px-2 py-1 font-jetbrains text-[10.5px] font-semibold ${SEVERITY_TEXT_CLASS[rule.severity]}`}
                  >
                    {SEVERITY_ICON[rule.severity]} {SEVERITY_LABEL[rule.severity]}
                  </span>
                  <span className="font-jetbrains text-[10.5px] font-semibold text-console-muted">{rule.code}</span>
                </div>
                <div className="mb-1.5 text-[15px] font-bold text-white">{rule.name}</div>
                <p className="text-[13px] leading-[1.6] text-console-subtle">{rule.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-10 pt-6 pb-16">
          <div className="flex items-center justify-between rounded-md border border-console-accent/20 bg-console-panel px-9 py-8">
            <div>
              <div className="mb-1.5 text-xl font-black text-white">내 설계도 검증해 볼까요?</div>
              <p className="text-sm text-console-subtle">지금 바로 캔버스를 열어서 직접 그려보세요.</p>
            </div>
            <StartCta user={user} />
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-console-accent/15 px-10 py-6">
          <span className="font-jetbrains text-[11px] font-semibold text-console-muted">ARCLAB.NANGMAN.CLOUD</span>
          <nav className="flex gap-6 font-sans text-xs text-console-muted">
            <a href={README_URL} target="_blank" rel="noreferrer" className="hover:text-console-accent-hover">
              문서
            </a>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-console-accent-hover">
              튜토리얼
            </a>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-console-accent-hover">
              GitHub
            </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
