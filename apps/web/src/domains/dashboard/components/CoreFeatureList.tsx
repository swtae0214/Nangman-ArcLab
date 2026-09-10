const CORE_FEATURES = [
  {
    number: 1,
    title: "아키텍처 캔버스",
    description: "드래그앤드롭으로 컴포넌트를 배치·연결하고 Auto Scaling / Multi-AZ / Multi-Region으로 묶습니다.",
  },
  {
    number: 2,
    title: "정적 검증 엔진",
    description: "Well-Architected Reliability Pillar 기반 5개 규칙으로 SPOF·이중화 누락을 즉시 확인합니다.",
  },
  {
    number: 3,
    title: "시뮬레이션 엔진",
    description: "M/M/c 큐잉 모델로 평상시·장애 시 지연시간, 처리량, 추정 가용성을 계산합니다.",
  },
];

export function CoreFeatureList() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-console-accent/15 bg-console-panel px-6 py-[22px]">
      <div className="font-jetbrains text-xs font-bold tracking-wide text-console-muted">핵심 기능</div>
      {CORE_FEATURES.map((feature) => (
        <div key={feature.number} className="flex items-start gap-3">
          <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded border-[1.5px] border-console-accent font-jetbrains text-xs font-bold text-console-accent">
            {feature.number}
          </div>
          <div>
            <div className="mb-0.5 text-[13.5px] font-bold text-white">{feature.title}</div>
            <div className="text-xs leading-[1.55] text-console-subtle">{feature.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
