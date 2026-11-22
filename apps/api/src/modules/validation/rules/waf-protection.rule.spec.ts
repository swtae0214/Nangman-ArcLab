import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateWafProtectionRule } from './waf-protection.rule.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges']): ArchitectureGraph {
  return { nodes, edges };
}

describe('evaluateWafProtectionRule', () => {
  it('로드밸런서 옆에 WAF가 없으면 위반으로 잡는다', () => {
    const result = evaluateWafProtectionRule(
      graph([{ id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } }], []),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['lb1']);
  });

  it('로드밸런서 옆에 WAF가 바로 있으면 통과한다', () => {
    const result = evaluateWafProtectionRule(
      graph(
        [
          { id: 'waf1', type: 'WAF', position: { x: 0, y: 0 }, data: { label: 'WAF' } },
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 1, y: 0 }, data: { label: 'LB' } },
        ],
        [{ id: 'e1', source: 'waf1', target: 'lb1' }],
      ),
    );

    expect(result.passed).toBe(true);
  });

  it('API Gateway도 진입점으로 같이 본다', () => {
    const result = evaluateWafProtectionRule(
      graph([{ id: 'gw1', type: 'API_GATEWAY', position: { x: 0, y: 0 }, data: { label: 'GW' } }], []),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['gw1']);
  });

  /** CDN→LB 구조에서 WAF가 CDN 쪽에 붙어 있어도 유효한 보호로 인정한다(SEC05-BP03에 명시). */
  it('로드밸런서 앞에 CDN이 있고 그 CDN에 WAF가 붙어 있으면 통과한다', () => {
    const result = evaluateWafProtectionRule(
      graph(
        [
          { id: 'waf1', type: 'WAF', position: { x: 0, y: 0 }, data: { label: 'WAF' } },
          { id: 'cdn1', type: 'CDN', position: { x: 1, y: 0 }, data: { label: 'CDN' } },
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 2, y: 0 }, data: { label: 'LB' } },
        ],
        [
          { id: 'e1', source: 'waf1', target: 'cdn1' },
          { id: 'e2', source: 'cdn1', target: 'lb1' },
        ],
      ),
    );

    expect(result.passed).toBe(true);
  });

  it('로드밸런서 앞에 CDN이 있어도 그 CDN에도 WAF가 없으면 위반으로 잡는다', () => {
    const result = evaluateWafProtectionRule(
      graph(
        [
          { id: 'cdn1', type: 'CDN', position: { x: 0, y: 0 }, data: { label: 'CDN' } },
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 1, y: 0 }, data: { label: 'LB' } },
        ],
        [{ id: 'e1', source: 'cdn1', target: 'lb1' }],
      ),
    );

    expect(result.passed).toBe(false);
  });

  it('진입점이 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateWafProtectionRule(graph([], []));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
