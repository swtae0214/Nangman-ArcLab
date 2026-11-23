"use client";

import type { CurrentUser, RuleSeverity, ValidationRuleCatalogItem } from "@nangman/shared-types";
import type { FC, ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { ConsoleNavBar } from "@/components/ConsoleNavBar";
import { COMPONENT_META } from "@/domains/architecture-canvas/component-meta";
import { GITHUB_LOGIN_URL } from "@/lib/api";
import { AuthErrorBanner } from "./AuthErrorBanner";
import { useCurrentUser } from "@/lib/use-current-user";
import { useValidationRuleCatalog } from "@/lib/use-catalog";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  SEVERITY_BADGE_BG_STYLE,
  SEVERITY_BORDER_STYLE,
  SEVERITY_ICON,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_SECTION_SUBTITLE,
  SEVERITY_TEXT_CLASS,
} from "@/lib/severity-colors";

/**
 * 홈 화면 개선(14단계): 규칙이 5개에서 12개로 늘어나면서 "캔버스를 실제로 연결 안 해도" 보여줄 수
 * 있는 히어로 미리보기는 전부 통과로 두면 밋밋해서, 실제로 이 샘플 다이어그램에 없는 걸(WAF) 하나
 * 일부러 "미충족"으로 둬서 "검증이 뭘 찾아주는지" 바로 보여준다. 실제 검증 엔진을 돌리는 게
 * 아니라 손으로 고른 마케팅용 예시 데이터라, 여기 숫자를 바꾸면 이 집합도 같이 맞춰야 한다.
 */
const HERO_FAILED_RULE_CODES = new Set(["SEC-002"]);

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

/** 샘플 다이어그램의 노드 하나(로드밸런서, 웹 서버 등)를 그리는 작은 박스 — 실제 캔버스와 같은 AWS 공식 아이콘을 쓴다. */
function DiagramNode({
  icon: Icon,
  label,
  sub,
  critical = false,
  muted = false,
  whiteIcon = false,
}: {
  icon: FC<{ size?: number | string; className?: string }>;
  label: string;
  sub: string;
  critical?: boolean;
  muted?: boolean;
  /** USER 아이콘은 원본 SVG가 짙은 남색(#242f3e) 고정이라 어두운 배경에서 거의 안 보여서, 테두리(path)만 흰색으로 덮어쓴다. */
  whiteIcon?: boolean;
}) {
  const toneClass = critical
    ? "border-console-critical text-console-critical"
    : muted
      ? "border-dashed border-console-accent/35 text-console-accent/50"
      : "border-console-accent text-console-accent";
  return (
    <div
      className={`flex w-[84px] flex-col items-center justify-center gap-1 rounded border px-1.5 py-2 text-center font-jetbrains text-[10px] font-semibold leading-tight ${toneClass}`}
    >
      <span className={`flex h-7 w-7 items-center justify-center ${muted ? "opacity-50" : ""}`}>
        <Icon size={22} className={whiteIcon ? "[&_path]:fill-white" : undefined} />
      </span>
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

/** 심각도 필터 칩(전체/심각/경고/정보) — 선택된 값만 색이 들어오고 나머지는 중립 테두리. */
function SeverityFilterChip({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-jetbrains text-xs font-semibold transition-colors ${
        active
          ? "border-console-accent bg-console-accent/15 text-console-accent"
          : "border-console-accent/20 text-console-muted hover:border-console-accent/40"
      }`}
    >
      {icon && <span>{icon}</span>}
      {label} <span className="opacity-70">{count}</span>
    </button>
  );
}

/** 카테고리 필터 칩(가용성/보안/용량·성능) — 심각도 칩과 모양을 구분하려고 둥근 사각형으로 둔다. */
function CategoryFilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1.5 font-jetbrains text-xs font-semibold transition-colors ${
        active
          ? "border-console-accent bg-console-accent/15 text-console-accent"
          : "border-console-accent/20 text-console-muted hover:border-console-accent/40"
      }`}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  );
}

/** 규칙 카드 하나 — 눌러서 펼치면 전체 설명 + 근거(Well-Architected citation)를 보여준다. */
function RuleCard({ rule, expanded, onToggle }: { rule: ValidationRuleCatalogItem; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      style={{ borderLeftColor: SEVERITY_BORDER_STYLE[rule.severity] }}
      className="rounded-md border border-console-accent/15 border-l-2 bg-console-panel p-5"
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <span className="mb-2 inline-block rounded border border-console-accent/20 px-2 py-0.5 font-jetbrains text-[10px] font-semibold text-console-muted">
            {CATEGORY_LABEL[rule.category]}
          </span>
          <div className="text-[15px] font-bold text-white">{rule.name}</div>
          <p className={`mt-1.5 text-[13px] leading-[1.6] text-console-subtle ${expanded ? "" : "line-clamp-2"}`}>{rule.description}</p>
        </div>
        <span className={`mt-1 flex-shrink-0 text-console-muted transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {expanded && (
        <div className="mt-3 border-t border-dashed border-console-accent/20 pt-3">
          <span className="text-[11px] text-console-muted">근거 · {rule.sourceCitation}</span>
        </div>
      )}
      <div className="mt-3 font-jetbrains text-[10.5px] font-semibold text-console-muted">{rule.code}</div>
    </div>
  );
}

/** 홈 화면 개선(14단계): 규칙이 12개로 늘어난 만큼, 전체 나열 대신 심각도/카테고리 필터 + 검색 +
 *  심각도별 묶음으로 바꿨다. 각 묶음은 접고 펼칠 수 있고, 카드도 눌러서 설명을 더 볼 수 있다. */
function RulesExplorerSection({ rules }: { rules: ValidationRuleCatalogItem[] }) {
  const [severityFilter, setSeverityFilter] = useState<RuleSeverity | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<ValidationRuleCatalogItem["category"] | null>(null);
  const [searchText, setSearchText] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<ReadonlySet<string>>(
    () => new Set(rules.length > 0 ? [rules[0].code] : []),
  );
  const [collapsedSeverities, setCollapsedSeverities] = useState<ReadonlySet<RuleSeverity>>(() => new Set());

  const toggleExpanded = (code: string) => {
    setExpandedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleSeverityCollapsed = (severity: RuleSeverity) => {
    setCollapsedSeverities((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRules = rules.filter((rule) => {
    if (severityFilter !== "ALL" && rule.severity !== severityFilter) return false;
    if (categoryFilter && rule.category !== categoryFilter) return false;
    if (!normalizedSearch) return true;
    return (
      rule.name.toLowerCase().includes(normalizedSearch) ||
      rule.description.toLowerCase().includes(normalizedSearch) ||
      rule.code.toLowerCase().includes(normalizedSearch)
    );
  });

  const severityCounts: Record<RuleSeverity, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  const categoryCounts: Record<ValidationRuleCatalogItem["category"], number> = { RELIABILITY: 0, SECURITY: 0, PERFORMANCE: 0 };
  for (const rule of rules) {
    severityCounts[rule.severity] += 1;
    categoryCounts[rule.category] += 1;
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-2.5 rounded-md border border-console-accent/15 bg-console-panel p-3.5">
        <SeverityFilterChip label="전체" count={rules.length} active={severityFilter === "ALL"} onClick={() => setSeverityFilter("ALL")} />
        {SEVERITY_ORDER.map((severity) => (
          <SeverityFilterChip
            key={severity}
            label={SEVERITY_LABEL[severity]}
            icon={SEVERITY_ICON[severity]}
            count={severityCounts[severity]}
            active={severityFilter === severity}
            onClick={() => setSeverityFilter(severityFilter === severity ? "ALL" : severity)}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-console-accent/15" aria-hidden />
        {CATEGORY_ORDER.map((category) => (
          <CategoryFilterChip
            key={category}
            label={CATEGORY_LABEL[category]}
            count={categoryCounts[category]}
            active={categoryFilter === category}
            onClick={() => setCategoryFilter(categoryFilter === category ? null : category)}
          />
        ))}
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="🔍 규칙 검색"
          className="ml-auto w-48 rounded border border-console-accent/20 bg-console-bg px-3 py-1.5 text-xs text-console-fg placeholder:text-console-muted focus:border-console-accent focus:outline-none"
        />
      </div>

      {filteredRules.length === 0 ? (
        <div className="rounded-md border border-console-accent/15 bg-console-panel p-8 text-center text-sm text-console-subtle">
          조건에 맞는 규칙이 없어요.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {SEVERITY_ORDER.filter((severity) => filteredRules.some((rule) => rule.severity === severity)).map((severity) => {
            const groupRules = filteredRules.filter((rule) => rule.severity === severity);
            const isCollapsed = collapsedSeverities.has(severity);
            return (
              <div key={severity}>
                <button
                  type="button"
                  onClick={() => toggleSeverityCollapsed(severity)}
                  className="mb-3 flex w-full items-center gap-2.5 text-left"
                >
                  <span className={`font-jetbrains text-xs font-bold ${SEVERITY_TEXT_CLASS[severity]}`}>
                    {SEVERITY_ICON[severity]} {SEVERITY_LABEL[severity]}
                  </span>
                  <span className="font-jetbrains text-xs font-semibold text-console-muted">{groupRules.length}개</span>
                  <span className="text-xs text-console-subtle">{SEVERITY_SECTION_SUBTITLE[severity]}</span>
                  <span className="ml-auto font-jetbrains text-xs text-console-muted">{isCollapsed ? "▾ 펼치기" : "▴ 접기"}</span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                    {groupRules.map((rule) => (
                      <RuleCard key={rule.code} rule={rule} expanded={expandedCodes.has(rule.code)} onToggle={() => toggleExpanded(rule.code)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function LandingPage() {
  const { data: rulesData } = useValidationRuleCatalog();
  const { data: user } = useCurrentUser();
  const rules = [...(rulesData ?? [])].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const [isPassedListOpen, setIsPassedListOpen] = useState(false);

  // 히어로 미리보기: HERO_FAILED_RULE_CODES에 손으로 골라 둔 규칙만 "미충족"으로 보여준다(실제
  // 검증 엔진을 돌리는 게 아니라 "검증이 뭘 찾아주는지" 보여주는 마케팅용 예시).
  const heroFailedRules = rules.filter((rule) => HERO_FAILED_RULE_CODES.has(rule.code));
  const heroPassedRules = rules.filter((rule) => !HERO_FAILED_RULE_CODES.has(rule.code));
  const heroWorstSeverity: RuleSeverity | null = heroFailedRules.length > 0 ? heroFailedRules[0].severity : null;
  const heroSeverityCounts: Record<RuleSeverity, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  for (const rule of heroFailedRules) heroSeverityCounts[rule.severity] += 1;

  return (
    <div className="min-h-screen bg-console-bg font-noto-kr text-console-fg">
      <div className="mx-auto max-w-[1360px]">
        <ConsoleNavBar variant="landing" />
        <AuthErrorBanner />

        <section className="px-10 pt-16 pb-12">
          <div className="mb-3.5 font-jetbrains text-xs font-semibold text-console-accent">
            ● LIVE · 아키텍처 검증 진행 중
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
                {heroWorstSeverity ? (
                  <span
                    style={{ backgroundColor: SEVERITY_BADGE_BG_STYLE[heroWorstSeverity] }}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 font-jetbrains text-[10.5px] font-semibold ${SEVERITY_TEXT_CLASS[heroWorstSeverity]}`}
                  >
                    {SEVERITY_ICON[heroWorstSeverity]} {SEVERITY_LABEL[heroWorstSeverity]} {heroFailedRules.length}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-console-accent/15 px-2 py-0.5 font-jetbrains text-[10.5px] font-semibold text-console-accent">
                    ✓ 통과
                  </span>
                )}
              </div>
              <span className="font-jetbrains text-[10.5px] font-semibold text-console-muted">예시 화면</span>
            </div>

            <div className="grid grid-cols-[1.7fr_1fr]">
              <div className="flex items-center overflow-x-auto p-7">
                <div className="flex items-stretch gap-3">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <DiagramNode icon={COMPONENT_META.USER.Icon} label="사용자" sub="User" whiteIcon />
                  </div>
                  <DiagramConnector />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <DiagramNode icon={COMPONENT_META.CDN.Icon} label="CDN" sub="CloudFront" />
                  </div>
                  <DiagramConnector />
                  <DiagramGroup label="VPC" className="flex items-stretch gap-4">
                    <DiagramGroup label="Public Subnet" className="flex items-center">
                      <div className="flex flex-col gap-2.5">
                        <DiagramNode icon={COMPONENT_META.LOAD_BALANCER.Icon} label="로드밸런서" sub="#1" />
                        <DiagramNode icon={COMPONENT_META.LOAD_BALANCER.Icon} label="로드밸런서" sub="#2" />
                      </div>
                    </DiagramGroup>
                    <DiagramConnector />
                    <DiagramGroup label="Private Subnet" className="flex items-center">
                      <DiagramGroup label="Auto Scaling" className="flex items-center">
                        <div className="flex flex-col gap-2.5">
                          <DiagramNode icon={COMPONENT_META.WEB_SERVER.Icon} label="웹 서버" sub="EC2 #1" />
                          <DiagramNode icon={COMPONENT_META.WEB_SERVER.Icon} label="웹 서버" sub="EC2 #2" />
                        </div>
                      </DiagramGroup>
                    </DiagramGroup>
                    <DiagramConnector />
                    <DiagramGroup label="Multi-AZ" className="flex items-center">
                      <div className="flex flex-col gap-2 pl-1">
                        <DiagramNode icon={COMPONENT_META.CACHE.Icon} label="캐시" sub="ElastiCache" />
                        <DiagramNode icon={COMPONENT_META.DB_PRIMARY.Icon} label="DB Primary" sub="RDS" />
                        <div className="pl-1 font-jetbrains text-[8px] text-console-muted">↓ 복제</div>
                        <DiagramNode icon={COMPONENT_META.DB_REPLICA.Icon} label="DB Replica" sub="RDS" muted />
                      </div>
                    </DiagramGroup>
                  </DiagramGroup>
                </div>
              </div>

              <div className="flex flex-col border-l border-console-accent/15">
                <div className="p-5">
                  <div className="mb-1 text-sm font-bold text-white">
                    {rules.length}개 규칙 중 {heroPassedRules.length}개 통과
                  </div>
                  <p className="mb-4 text-xs text-console-subtle">
                    {heroFailedRules.length > 0 ? `${heroFailedRules.length}개를 확인해 보세요` : "모두 통과했어요"}
                  </p>

                  <div className="mb-4 flex items-center gap-3">
                    {SEVERITY_ORDER.map((severity) => (
                      <span key={severity} className={`flex items-center gap-1 font-jetbrains text-[11px] font-semibold ${SEVERITY_TEXT_CLASS[severity]}`}>
                        {SEVERITY_ICON[severity]} {SEVERITY_LABEL[severity]} {heroSeverityCounts[severity]}
                      </span>
                    ))}
                  </div>

                  {heroFailedRules.map((rule) => (
                    <div
                      key={rule.code}
                      style={{ borderColor: SEVERITY_BORDER_STYLE[rule.severity] }}
                      className="mb-3 rounded-md border bg-console-bg p-3.5"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span
                          style={{ backgroundColor: SEVERITY_BADGE_BG_STYLE[rule.severity] }}
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-jetbrains text-[9.5px] font-semibold ${SEVERITY_TEXT_CLASS[rule.severity]}`}
                        >
                          {SEVERITY_ICON[rule.severity]} {SEVERITY_LABEL[rule.severity]}
                        </span>
                        <span className="rounded border border-console-accent/20 px-1.5 py-0.5 font-jetbrains text-[9.5px] font-semibold text-console-muted">
                          {CATEGORY_LABEL[rule.category]}
                        </span>
                      </div>
                      <div className="mb-1 text-[13px] font-bold text-white">{rule.name}</div>
                      <p className="mb-2 text-[12px] leading-[1.6] text-console-subtle">{rule.description}</p>
                      <a
                        href={user ? "/architectures" : GITHUB_LOGIN_URL}
                        className="text-[12px] font-semibold text-console-accent hover:text-console-accent-hover"
                      >
                        캔버스에서 확인 →
                      </a>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsPassedListOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-md border border-console-accent/15 px-3.5 py-2.5 text-xs font-semibold text-console-fg hover:border-console-accent/30"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-console-accent">✓</span> 통과한 규칙 {heroPassedRules.length}개
                    </span>
                    <span className="text-console-muted">{isPassedListOpen ? "▴" : "▾"}</span>
                  </button>
                  {isPassedListOpen && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {heroPassedRules.map((rule) => (
                        <li key={rule.code} className="flex items-center gap-1.5 text-xs text-console-subtle">
                          <span className="text-console-accent">✓</span> {rule.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  <a href="#rules" className="mt-3 block text-xs font-semibold text-console-accent hover:text-console-accent-hover">
                    전체 규칙 {rules.length}개 보기 →
                  </a>
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
          <h2 className="mb-1.5 text-2xl font-black text-white">검증 규칙 {rules.length}가지</h2>
          <p className="mb-7 text-xs text-console-subtle">중요도는 색과 모양, 글자로 함께 표시돼요. 카드를 누르면 자세한 설명이 펼쳐져요.</p>
          <RulesExplorerSection rules={rules} />
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
