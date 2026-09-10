import type { ValidationRuleResult } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { summarizeLatestSimulationRun, summarizeValidation } from './dashboard-stats.util.js';

function ruleResult(overrides: Partial<ValidationRuleResult>): ValidationRuleResult {
  return {
    ruleCode: 'TEST-001',
    name: '테스트 규칙',
    description: '',
    severity: 'INFO',
    sourceCitation: '',
    passed: true,
    detail: {},
    ...overrides,
  };
}

function decimal(value: number) {
  return { toNumber: () => value };
}

describe('summarizeValidation', () => {
  it('모두 통과하면 failedCount 0, worstSeverity null', () => {
    const summary = summarizeValidation({
      passed: true,
      results: [ruleResult({ passed: true }), ruleResult({ passed: true })],
    });
    expect(summary).toEqual({ passed: true, totalCount: 2, failedCount: 0, worstSeverity: null, failedRules: [] });
  });

  it('실패한 규칙 중 가장 심각한 severity를 worstSeverity로 뽑고, 실패한 규칙 목록도 함께 내려준다', () => {
    const summary = summarizeValidation({
      passed: false,
      results: [
        ruleResult({ ruleCode: 'A', name: 'A 규칙', passed: false, severity: 'WARNING' }),
        ruleResult({ ruleCode: 'B', name: 'B 규칙', passed: false, severity: 'CRITICAL' }),
        ruleResult({ ruleCode: 'C', name: 'C 규칙', passed: true, severity: 'CRITICAL' }),
      ],
    });
    expect(summary).toEqual({
      passed: false,
      totalCount: 3,
      failedCount: 2,
      worstSeverity: 'CRITICAL',
      failedRules: [
        { ruleCode: 'A', name: 'A 규칙', severity: 'WARNING' },
        { ruleCode: 'B', name: 'B 규칙', severity: 'CRITICAL' },
      ],
    });
  });
});

describe('summarizeLatestSimulationRun', () => {
  it('포화 구간이 없으면 baseline 노드들의 지연시간 합과 100% 근접 가용성을 낸다', () => {
    const summary = summarizeLatestSimulationRun({
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      observationPeriodSec: 1000,
      failureDurationSec: null,
      expectedRps: decimal(100),
      simulationMetrics: [
        { scenarioPhase: 'BASELINE', avgLatencyMs: decimal(5), throughputRps: decimal(100), isSaturated: false },
        { scenarioPhase: 'BASELINE', avgLatencyMs: decimal(3), throughputRps: decimal(100), isSaturated: false },
      ],
    });

    expect(summary.avgLatencyMs).toBeCloseTo(8, 5);
    expect(summary.estimatedAvailabilityPercent).toBeCloseTo(100, 5);
    expect(summary.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('baseline 구간이 포화 상태면 지연시간은 null이고 가용성은 처리량 비율만큼 깎인다', () => {
    const summary = summarizeLatestSimulationRun({
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      observationPeriodSec: 1000,
      failureDurationSec: 0,
      expectedRps: decimal(100),
      simulationMetrics: [
        { scenarioPhase: 'BASELINE', avgLatencyMs: null, throughputRps: decimal(60), isSaturated: true },
      ],
    });

    expect(summary.avgLatencyMs).toBeNull();
    expect(summary.estimatedAvailabilityPercent).toBeCloseTo(60, 5);
  });

  it('장애 시나리오 구간(DURING_FAILURE)까지 있으면 관찰 기간 가중평균에 반영된다', () => {
    const summary = summarizeLatestSimulationRun({
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      observationPeriodSec: 1000,
      failureDurationSec: 100,
      expectedRps: decimal(100),
      simulationMetrics: [
        { scenarioPhase: 'BASELINE', avgLatencyMs: decimal(10), throughputRps: decimal(100), isSaturated: false },
        { scenarioPhase: 'DURING_FAILURE', avgLatencyMs: null, throughputRps: decimal(50), isSaturated: true },
      ],
    });

    // 정상 900초(100%) + 장애 100초(50%) = 95%
    expect(summary.estimatedAvailabilityPercent).toBeCloseTo(95, 5);
    // 라벨/화면에 노출되는 지연시간은 baseline 기준(정상 상태) 값이다.
    expect(summary.avgLatencyMs).toBeCloseTo(10, 5);
  });
});
