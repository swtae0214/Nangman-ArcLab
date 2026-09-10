/**
 * design_handoff_home_dashboard/README.md: "아키텍처가 0개일 때의 빈 상태(empty state) UI는
 * 아직 디자인되지 않음 → 이번엔 카드 그리드 자리에 '첫 아키텍처를 시작해보세요' CTA 카드 하나로
 * 대체"라고 명시돼 있어서, 그 지시대로 카드 그리드와 같은 자리에 들어가는 CTA 카드로 만들었다.
 */
export function EmptyStateCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-console-accent/25 bg-console-panel px-8 py-14 text-center">
      <div className="text-[15px] font-bold text-white">아직 만든 아키텍처가 없어요</div>
      <div className="max-w-[320px] text-[13px] leading-[1.6] text-console-subtle">
        캔버스에 로드밸런서·서버·DB를 배치하고 정적 검증과 시뮬레이션으로 가용성을 확인해보세요.
      </div>
    </div>
  );
}
