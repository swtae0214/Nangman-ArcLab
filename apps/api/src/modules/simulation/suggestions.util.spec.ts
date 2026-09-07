import type { ArchitectureValidationReport } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { generateSuggestions } from './suggestions.util.js';

function report(results: ArchitectureValidationReport['results']): ArchitectureValidationReport {
  return { passed: results.every((r) => r.passed), results };
}

describe('generateSuggestions', () => {
  it('실패한 규칙에만 제안을 만든다', () => {
    const suggestions = generateSuggestions(
      report([
        { ruleCode: 'SPOF-001', name: '', description: '', severity: 'CRITICAL', sourceCitation: '', passed: false, detail: {} },
        { ruleCode: 'ASG-001', name: '', description: '', severity: 'WARNING', sourceCitation: '', passed: true, detail: {} },
      ]),
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('이중화');
  });

  it('전부 통과했으면 제안이 없다', () => {
    const suggestions = generateSuggestions(
      report([{ ruleCode: 'SPOF-001', name: '', description: '', severity: 'CRITICAL', sourceCitation: '', passed: true, detail: {} }]),
    );
    expect(suggestions).toHaveLength(0);
  });
});
