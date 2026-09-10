"use client";

import Link from "next/link";
import { ConsoleNavBar } from "@/components/ConsoleNavBar";
import { useValidationRuleCatalog } from "@/lib/use-catalog";
import { SEVERITY_BORDER_STYLE, SEVERITY_TEXT_CLASS } from "@/lib/severity-colors";

const FEATURES = [
  {
    step: "01",
    label: "CANVAS",
    title: "아키텍처 캔버스",
    description:
      "React Flow 기반 드래그앤드롭 에디터로 LB·웹서버·DB·캐시·CDN을 배치하고 Auto Scaling / Multi-AZ / Multi-Region으로 묶습니다.",
  },
  {
    step: "02",
    label: "STATIC CHECK",
    title: "정적 검증 엔진",
    description: "Well-Architected Reliability Pillar 기반 5개 규칙으로 SPOF·이중화 누락을 즉시 캔버스에 표시합니다.",
  },
  {
    step: "03",
    label: "SIMULATION",
    title: "시뮬레이션 엔진",
    description: "Jackson Network + M/M/c 큐잉 모델로 평상시·장애 시 지연시간, 처리량, 추정 가용성을 계산합니다.",
  },
];

export function LandingPage() {
  const { data: rules } = useValidationRuleCatalog();

  return (
    <div className="min-h-screen bg-console-bg font-noto-kr text-console-fg">
      <div className="mx-auto max-w-[1360px]">
        <ConsoleNavBar variant="landing" />

        <section className="px-10 pt-16 pb-12">
          <div className="mb-3.5 font-jetbrains text-xs font-semibold text-console-accent">
            ● LIVE · 아키텍처 검증 진행 중
          </div>
          <h1 className="mb-[18px] max-w-[720px] text-[44px] leading-[1.22] font-black text-white">
            당신의 설계, 지금
            <br />
            실시간으로 검증됩니다
          </h1>
          <p className="mb-[30px] max-w-[540px] text-base leading-[1.75] text-console-subtle">
            캔버스에서 바꾼 구조가 곧바로 SPOF 검사와 M/M/c 큐잉 시뮬레이션을 거쳐 지연시간·처리량·가용성 지표로
            돌아옵니다.
          </p>
          <div className="mb-11 flex gap-3">
            <Link
              href="/architectures"
              className="rounded bg-console-accent px-6 py-3.5 text-sm font-bold text-console-bg hover:bg-console-accent-hover"
            >
              캔버스 시작하기 →
            </Link>
            <a
              href="https://github.com/swtae0214/Nangman-ArcLab"
              target="_blank"
              rel="noreferrer"
              className="rounded border border-console-accent/35 px-6 py-3.5 font-jetbrains text-sm font-semibold text-console-fg hover:border-console-accent"
            >
              GitHub
            </a>
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-4">
            <div className="rounded-md border border-console-accent/20 bg-console-panel px-7 py-6">
              <div className="mb-4 font-jetbrains text-[11px] font-semibold text-console-muted">
                ARCHITECTURE GRAPH
              </div>
              <div className="flex items-center">
                <div className="flex h-[34px] w-14 flex-shrink-0 items-center justify-center rounded border border-console-accent font-jetbrains text-[11px] font-semibold text-console-accent">
                  LB
                </div>
                <div className="h-0.5 w-6 flex-1 bg-console-accent" />
                <div className="flex flex-shrink-0 flex-col gap-2.5">
                  <div className="flex h-[26px] w-14 items-center justify-center rounded border border-console-accent font-jetbrains text-[11px] font-semibold text-console-accent">
                    WEB
                  </div>
                  <div className="flex h-[26px] w-14 items-center justify-center rounded border border-console-accent font-jetbrains text-[11px] font-semibold text-console-accent">
                    WEB
                  </div>
                </div>
                <div className="h-0.5 w-6 flex-1 bg-[#ff5a5a]" />
                <div className="flex h-[34px] w-16 flex-shrink-0 items-center justify-center rounded border border-[#ff5a5a] font-jetbrains text-[11px] font-semibold text-console-critical">
                  CACHE
                </div>
                <div className="h-0.5 w-6 flex-1 bg-console-accent" />
                <div className="flex flex-shrink-0 flex-col gap-2.5">
                  <div className="flex h-[26px] w-[68px] items-center justify-center rounded border border-console-accent font-jetbrains text-[11px] font-semibold text-console-accent">
                    DB PRI
                  </div>
                  <div className="flex h-[26px] w-[68px] items-center justify-center rounded border border-dashed border-console-accent/35 font-jetbrains text-[11px] font-semibold text-console-accent/50">
                    DB REP
                  </div>
                </div>
              </div>
              <div className="mt-[18px] border-t border-dashed border-[#ff5a5a]/30 pt-3 font-jetbrains text-[10.5px] font-semibold text-console-critical">
                ⚠ MULTIAZ-002 · 캐시 단일 인스턴스 (WARNING)
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-md border border-console-accent/20 bg-console-panel px-5 py-[18px]">
                <span className="text-xs font-medium text-console-muted">추정 가용성</span>
                <span className="font-jetbrains text-xl font-bold text-console-accent">99.94%</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-console-accent/20 bg-console-panel px-5 py-[18px]">
                <span className="text-xs font-medium text-console-muted">평균 지연시간</span>
                <span className="font-jetbrains text-xl font-bold text-white">184ms</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#ff5a5a]/30 bg-console-panel px-5 py-[18px]">
                <span className="text-xs font-medium text-console-muted">위반 규칙</span>
                <span className="font-jetbrains text-xl font-bold text-console-critical">2건</span>
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

        <section id="rules" className="px-10 pt-8 pb-10">
          <div className="mb-4 font-jetbrains text-xs font-bold tracking-wide text-console-accent">
            STATIC VALIDATION RULES
          </div>
          <div className="mb-9 flex flex-wrap gap-2.5">
            {(rules ?? []).map((rule) => (
              <div
                key={rule.code}
                style={{ borderColor: SEVERITY_BORDER_STYLE[rule.severity] }}
                className={`flex items-center gap-2 rounded border px-3.5 py-2.5 font-jetbrains text-[11.5px] font-semibold ${SEVERITY_TEXT_CLASS[rule.severity]}`}
              >
                {rule.code} <span className="opacity-60">{rule.name}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-console-accent/15 pt-6">
            <Link
              href="/architectures"
              className="rounded bg-console-accent px-6 py-3.5 text-sm font-bold text-console-bg hover:bg-console-accent-hover"
            >
              캔버스 시작하기 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
