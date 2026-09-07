import type { ArchitectureGraph, ComponentPresetCatalogItem } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { calculateMMc } from './queueing.util.js';
import { computePipeline } from './pipeline.util.js';

const PRESETS: ComponentPresetCatalogItem[] = [
  { code: 'ws-preset', componentType: 'WEB_SERVER', displayName: 'WS Preset', serviceRateRps: 100, sourceNote: '' },
  { code: 'db-preset', componentType: 'DB_PRIMARY', displayName: 'DB Preset', serviceRateRps: 50, sourceNote: '' },
  { code: 'cache-preset', componentType: 'CACHE', displayName: 'Cache Preset', serviceRateRps: 1000, sourceNote: '' },
];

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges']): ArchitectureGraph {
  return { nodes, edges };
}

describe('computePipeline', () => {
  it('LB-WS-DB 단순 체인의 종단 지연시간은 각 구간 M/M/c 지연시간의 합과 같다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS', presetCode: 'ws-preset' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'ws1', target: 'db1' },
        ],
      ),
      30,
      PRESETS,
    );

    const expectedWs = calculateMMc({ lambdaRps: 30, muRps: 100, instanceCount: 1 });
    const expectedDb = calculateMMc({ lambdaRps: 30, muRps: 50, instanceCount: 1 });

    expect(result.nodeMetrics).toHaveLength(2);
    expect(result.endToEndLatencyMs).toBeCloseTo(expectedWs.avgLatencyMs + expectedDb.avgLatencyMs, 5);
    expect(result.throughputRps).toBeCloseTo(30, 5);
  });

  it('캐시가 경로에 있으면 DB로 가는 트래픽이 캐시 적중률만큼 줄어든다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS', presetCode: 'ws-preset' } },
          { id: 'cache1', type: 'CACHE', position: { x: 2, y: 0 }, data: { label: 'Cache', presetCode: 'cache-preset' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 3, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'ws1', target: 'cache1' },
          { id: 'e3', source: 'cache1', target: 'db1' },
        ],
      ),
      30,
      PRESETS,
    );

    const dbMetric = result.nodeMetrics.find((metric) => metric.nodeType === 'DB_PRIMARY');
    expect(dbMetric?.lambdaRps).toBeCloseTo(30 * 0.3, 5); // 적중률 70% 가정 → 30%만 DB로
    expect(result.warnings.some((warning) => warning.includes('캐시 적중률'))).toBe(true);
    // 캐시가 트래픽을 흡수해서 DB의 λ(자연히 작은 값)를 병목으로 오인하면 안 된다 —
    // 어디도 포화되지 않았으므로 전체 처리량은 원래 들어온 요청량(30)과 같아야 한다.
    expect(result.nodeMetrics.every((metric) => !metric.isSaturated)).toBe(true);
    expect(result.throughputRps).toBeCloseTo(30, 5);
  });

  it('한 구간이 포화되면 전체 처리량은 그 구간의 한계치(c·μ)로 제한된다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS', presetCode: 'ws-preset' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'ws1', target: 'db1' },
        ],
      ),
      1000, // db-preset의 muRps=50이라 c=1로는 감당 못 함 (포화)
      PRESETS,
    );

    const dbMetric = result.nodeMetrics.find((metric) => metric.nodeType === 'DB_PRIMARY');
    expect(dbMetric?.isSaturated).toBe(true);
    expect(result.throughputRps).toBeCloseTo(50, 5); // c(1) * muRps(50)
  });

  it('같은 ASG 아래 웹서버 여러 대는 하나의 큐로 합쳐져 c가 커진다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'asg1', type: 'AUTO_SCALING_GROUP', position: { x: 1, y: 0 }, data: { label: 'ASG' } },
          { id: 'ws1', type: 'WEB_SERVER', logicalGroupId: 'asg1', position: { x: 0, y: 0 }, data: { label: 'WS1', presetCode: 'ws-preset' } },
          { id: 'ws2', type: 'WEB_SERVER', logicalGroupId: 'asg1', position: { x: 1, y: 0 }, data: { label: 'WS2', presetCode: 'ws-preset' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'lb1', target: 'ws2' },
          { id: 'e3', source: 'ws1', target: 'db1' },
          { id: 'e4', source: 'ws2', target: 'db1' },
        ],
      ),
      30,
      PRESETS,
    );

    const webMetric = result.nodeMetrics.find((metric) => metric.nodeType === 'WEB_SERVER');
    expect(webMetric?.instanceCount).toBe(2);
  });

  it('프리셋이 지정 안 된 노드는 같은 타입의 기본 프리셋으로 계산하고 경고를 남긴다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'ws1', target: 'db1' },
        ],
      ),
      30,
      PRESETS,
    );

    const webMetric = result.nodeMetrics.find((metric) => metric.nodeType === 'WEB_SERVER');
    expect(webMetric?.muRps).toBe(100);
    expect(result.warnings.some((warning) => warning.includes('프리셋이 지정되지 않아'))).toBe(true);
  });

  it('로드밸런서나 DB가 없으면 계산할 대상이 없다고 알린다', () => {
    const result = computePipeline(
      graph([{ id: 'ws1', type: 'WEB_SERVER', position: { x: 0, y: 0 }, data: { label: 'WS' } }], []),
      30,
      PRESETS,
    );
    expect(result.nodeMetrics).toHaveLength(0);
    expect(result.endToEndLatencyMs).toBeNull();
  });

  it('LB와 DB가 있어도 서로 연결되어 있지 않으면 경로를 못 찾았다고 알린다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 1, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [],
      ),
      30,
      PRESETS,
    );
    expect(result.nodeMetrics).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes('경로를 찾지 못했습니다'))).toBe(true);
  });

  it('capacityReducedNodeIds에 포함된 웹서버 그룹은 인스턴스 수가 절반(최소 1)으로 줄어든다', () => {
    const result = computePipeline(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'asg1', type: 'AUTO_SCALING_GROUP', position: { x: 1, y: 0 }, data: { label: 'ASG' } },
          { id: 'ws1', type: 'WEB_SERVER', logicalGroupId: 'asg1', position: { x: 0, y: 0 }, data: { label: 'WS1', presetCode: 'ws-preset' } },
          { id: 'ws2', type: 'WEB_SERVER', logicalGroupId: 'asg1', position: { x: 1, y: 0 }, data: { label: 'WS2', presetCode: 'ws-preset' } },
          { id: 'ws3', type: 'WEB_SERVER', logicalGroupId: 'asg1', position: { x: 2, y: 0 }, data: { label: 'WS3', presetCode: 'ws-preset' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB', presetCode: 'db-preset' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'ws1', target: 'db1' },
          { id: 'e3', source: 'lb1', target: 'ws2' },
          { id: 'e4', source: 'ws2', target: 'db1' },
          { id: 'e5', source: 'lb1', target: 'ws3' },
          { id: 'e6', source: 'ws3', target: 'db1' },
        ],
      ),
      30,
      PRESETS,
      { capacityReducedNodeIds: new Set(['ws1']), capacityReductionRatio: 0.5 },
    );

    const webMetric = result.nodeMetrics.find((metric) => metric.nodeType === 'WEB_SERVER');
    expect(webMetric?.instanceCount).toBe(1); // floor(3 * 0.5) = 1
  });
});
