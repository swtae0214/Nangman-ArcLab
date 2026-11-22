import type { ArchitectureGraph, ComponentPresetCatalogItem, GraphNode } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { estimateMonthlyCostUsd } from './cost.util.js';

function node(id: string, type: GraphNode['type'], overrides: Partial<GraphNode['data']> = {}): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...overrides } };
}

function preset(overrides: Partial<ComponentPresetCatalogItem> & Pick<ComponentPresetCatalogItem, 'code' | 'componentType'>): ComponentPresetCatalogItem {
  return { displayName: overrides.code, serviceRateRps: 100, sourceNote: 'test', ...overrides };
}

describe('estimateMonthlyCostUsd', () => {
  it('프리셋이 있는 노드는 프리셋 단가 × 인스턴스 수를 더한다', () => {
    const graph: ArchitectureGraph = {
      nodes: [node('web', 'WEB_SERVER', { presetCode: 'ec2', instanceCount: 3 })],
      edges: [],
    };
    const presets = [preset({ code: 'ec2', componentType: 'WEB_SERVER', monthlyCostUsd: 10 })];

    expect(estimateMonthlyCostUsd(graph, presets)).toBe(30);
  });

  it('프리셋을 아직 안 골랐거나 그 프리셋에 가격 데이터가 없으면 합계에서 제외한다', () => {
    const graphNoPreset: ArchitectureGraph = { nodes: [node('web', 'WEB_SERVER')], edges: [] };
    expect(estimateMonthlyCostUsd(graphNoPreset, [])).toBe(0);

    const graphNoPrice: ArchitectureGraph = { nodes: [node('web', 'WEB_SERVER', { presetCode: 'ec2' })], edges: [] };
    const presetsNoPrice = [preset({ code: 'ec2', componentType: 'WEB_SERVER' })];
    expect(estimateMonthlyCostUsd(graphNoPrice, presetsNoPrice)).toBe(0);
  });

  /**
   * apps/web의 node-cost.ts(summarizeArchitectureCost)와 같은 공식(usage-based-cost.ts)으로
   * CDN/LOAD_BALANCER 비용을 계산하는지 확인 — 이게 어긋나면 Cost 탭과 시뮬레이션/What-if 탭의
   * 숫자가 서로 달라지는 버그가 재발한다.
   */
  it('CDN/LOAD_BALANCER는 트래픽 전파 엔진이 계산한 RPS로 사용량 기반 비용을 더한다', () => {
    const graph: ArchitectureGraph = {
      nodes: [
        node('user', 'USER', { entryAvgRps: 100, entryAvgResponseSizeKb: 2.6 }),
        node('cdn', 'CDN'),
        node('lb', 'LOAD_BALANCER', { albConnectionReuse: true, albRequestsPerConnection: 1000 }),
      ],
      edges: [
        { id: 'e1', source: 'user', target: 'cdn' },
        { id: 'e2', source: 'cdn', target: 'lb' },
      ],
    };

    const total = estimateMonthlyCostUsd(graph, []);
    expect(total).toBeGreaterThan(0);
  });

  it('연결된 트래픽 경로가 없어 RPS를 구할 수 없는 CDN/LOAD_BALANCER는 합계에서 제외한다', () => {
    const graph: ArchitectureGraph = { nodes: [node('cdn', 'CDN')], edges: [] };
    expect(estimateMonthlyCostUsd(graph, [])).toBe(0);
  });

  it('과금 대상이 아닌 타입(예: USER)은 무시한다', () => {
    const graph: ArchitectureGraph = { nodes: [node('user', 'USER', { entryAvgRps: 100 })], edges: [] };
    expect(estimateMonthlyCostUsd(graph, [])).toBe(0);
  });
});
