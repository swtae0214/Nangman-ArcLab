import { describe, expect, it } from 'vitest';
import { calculateMMc } from './queueing.util.js';

describe('calculateMMc', () => {
  it('c=1(M/M/1)일 때 교과서 공식과 일치한다: waitProbability=ρ, Lq=ρ²/(1-ρ)', () => {
    // a=λ/μ=0.4, ρ=0.4 — M/M/1의 알려진 폐형식(Erlang C(1,a)=ρ, Lq=ρ²/(1-ρ))으로 직접 검산.
    const result = calculateMMc({ lambdaRps: 2, muRps: 5, instanceCount: 1 });

    expect(result.rho).toBeCloseTo(0.4, 10);
    expect(result.waitProbability).toBeCloseTo(0.4, 10);
    expect(result.avgQueueLength).toBeCloseTo(0.4 ** 2 / (1 - 0.4), 10);
    expect(result.avgLatencyMs).toBeCloseTo(333.333, 2);
    expect(result.isSaturated).toBe(false);
  });

  it('c=2일 때 손으로 계산한 값과 일치한다', () => {
    // a=1.5, ρ=0.75 — P0=1/7, Erlang C=0.642857, Lq=1.928571, W=1.142857초를 손으로 미리 계산해둔 값.
    const result = calculateMMc({ lambdaRps: 3, muRps: 2, instanceCount: 2 });

    expect(result.rho).toBeCloseTo(0.75, 10);
    expect(result.waitProbability).toBeCloseTo(0.642857, 5);
    expect(result.avgQueueLength).toBeCloseTo(1.928571, 5);
    expect(result.avgLatencyMs).toBeCloseTo(1142.857, 1);
  });

  it('ρ가 1 이상이면 포화 상태로 보고 처리량을 c·μ로 제한한다', () => {
    const result = calculateMMc({ lambdaRps: 100, muRps: 10, instanceCount: 5 });

    expect(result.rho).toBeGreaterThanOrEqual(1);
    expect(result.isSaturated).toBe(true);
    expect(result.throughputRps).toBe(50);
    expect(result.avgLatencyMs).toBe(Infinity);
  });

  it('요청이 없으면(λ=0) 대기 없이 서비스 시간만 걸린다', () => {
    const result = calculateMMc({ lambdaRps: 0, muRps: 10, instanceCount: 3 });

    expect(result.rho).toBe(0);
    expect(result.avgWaitTimeMs).toBe(0);
    expect(result.avgLatencyMs).toBeCloseTo(100, 5);
    expect(result.throughputRps).toBe(0);
  });

  it('잘못된 입력은 에러를 던진다', () => {
    expect(() => calculateMMc({ lambdaRps: -1, muRps: 10, instanceCount: 1 })).toThrow();
    expect(() => calculateMMc({ lambdaRps: 1, muRps: 0, instanceCount: 1 })).toThrow();
    expect(() => calculateMMc({ lambdaRps: 1, muRps: 10, instanceCount: 0 })).toThrow();
    expect(() => calculateMMc({ lambdaRps: 1, muRps: 10, instanceCount: 1.5 })).toThrow();
  });
});
