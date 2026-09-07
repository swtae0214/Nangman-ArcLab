import { describe, expect, it } from 'vitest';
import { estimateAvailabilityPercent } from './availability.util.js';

describe('estimateAvailabilityPercent', () => {
  it('장애 없이 처리량이 요청량을 다 감당하면 100%', () => {
    const result = estimateAvailabilityPercent({
      observationPeriodSec: 2_592_000,
      failureDurationSec: 0,
      expectedRps: 100,
      baselineThroughputRps: 100,
      duringFailureThroughputRps: null,
    });
    expect(result).toBeCloseTo(100, 5);
  });

  it('장애 구간 동안 처리량이 절반이면, 관찰 기간 대비 장애 비중만큼만 가용성이 깎인다', () => {
    // 관찰기간 1000초 중 장애 100초, 장애 중 처리량이 요청량의 절반.
    const result = estimateAvailabilityPercent({
      observationPeriodSec: 1000,
      failureDurationSec: 100,
      expectedRps: 100,
      baselineThroughputRps: 100,
      duringFailureThroughputRps: 50,
    });
    // 정상 900초(100%) + 장애 100초(50%) = (900*1 + 100*0.5)/1000 = 0.95
    expect(result).toBeCloseTo(95, 5);
  });

  it('평상시부터 처리량이 요청량에 못 미치면 장애가 없어도 100% 미만이다', () => {
    const result = estimateAvailabilityPercent({
      observationPeriodSec: 1000,
      failureDurationSec: 0,
      expectedRps: 100,
      baselineThroughputRps: 80,
      duringFailureThroughputRps: null,
    });
    expect(result).toBeCloseTo(80, 5);
  });

  it('장애 지속시간이 관찰 기간보다 길게 들어와도 관찰 기간을 넘지 않게 자른다', () => {
    const result = estimateAvailabilityPercent({
      observationPeriodSec: 100,
      failureDurationSec: 10_000,
      expectedRps: 100,
      baselineThroughputRps: 100,
      duringFailureThroughputRps: 0,
    });
    expect(result).toBeCloseTo(0, 5);
  });
});
