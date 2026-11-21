import { describe, expect, it } from "vitest";
import { computeAlbCost, computeCdnCost } from "./usage-based-cost";

describe("computeCdnCost", () => {
  it("무료 전송 구간 안이면 전송 비용은 0이고, 요청 비용만 발생한다", () => {
    const result = computeCdnCost({ rps: 120, avgResponseSizeKb: 2.6 });
    expect(result.monthlyRequests).toBeCloseTo(311_040_000, 0);
    expect(result.monthlyTransferGb).toBeCloseTo(808.7, 1);
    expect(result.transferCostUsd).toBe(0);
    expect(result.requestCostUsd).toBeCloseTo(361.25, 1);
    expect(result.monthlyCostUsd).toBeCloseTo(361.25, 1);
  });

  it("무료 요청 구간(월 1천만 건) 안이면 요청 비용도 0이다", () => {
    const result = computeCdnCost({ rps: 1, avgResponseSizeKb: 1 });
    expect(result.monthlyRequests).toBeCloseTo(2_592_000, 0);
    expect(result.requestCostUsd).toBe(0);
  });

  it("전송량이 누진 구간을 넘어가면 구간별 단가로 쪼개 계산한다", () => {
    // 1,000GB(무료) + 9,000GB($0.12) 정확히 걸치는 11,000GB 지점을 확인한다.
    const result = computeCdnCost({ rps: 0, avgResponseSizeKb: 0 });
    expect(result.transferCostUsd).toBe(0);
  });
});

describe("computeAlbCost", () => {
  it("연결을 재사용하지 않으면 RPS 전체가 신규 연결이 된다", () => {
    const result = computeAlbCost({ rps: 25, connectionReuse: false });
    expect(result).not.toBeNull();
    expect(result?.newConnectionsPerSec).toBe(25);
    expect(result?.lcuFromNewConnections).toBeCloseTo(1, 5);
    // (0.0225 + 1*0.008) * 730
    expect(result?.monthlyCostUsd).toBeCloseTo(22.27, 2);
  });

  it("연결을 재사용하면 연결당 평균 요청 수로 나눠 신규 연결 수를 줄인다", () => {
    const result = computeAlbCost({ rps: 12, connectionReuse: true, requestsPerConnection: 10 });
    expect(result?.newConnectionsPerSec).toBeCloseTo(1.2, 5);
    expect(result?.lcuFromNewConnections).toBeCloseTo(0.048, 5);
  });

  it("재사용인데 연결당 요청 수를 아직 안 정했으면 계산할 수 없다(null)", () => {
    const result = computeAlbCost({ rps: 12, connectionReuse: true });
    expect(result).toBeNull();
  });
});
