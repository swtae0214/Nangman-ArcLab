import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateKmsEncryptionRule } from './kms-encryption.rule.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges'] = []): ArchitectureGraph {
  return { nodes, edges };
}

describe('evaluateKmsEncryptionRule', () => {
  it('RDS에 KMS가 연결되어 있지 않으면 위반으로 잡는다', () => {
    const result = evaluateKmsEncryptionRule(
      graph([{ id: 'db1', type: 'DB_PRIMARY', position: { x: 0, y: 0 }, data: { label: 'DB' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['db1']);
  });

  it('RDS에 KMS가 연결되어 있으면 통과한다', () => {
    const result = evaluateKmsEncryptionRule(
      graph(
        [
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 0, y: 0 }, data: { label: 'DB' } },
          { id: 'kms1', type: 'KMS', position: { x: 1, y: 0 }, data: { label: 'KMS' } },
        ],
        [{ id: 'e1', source: 'kms1', target: 'db1' }],
      ),
    );

    expect(result.passed).toBe(true);
  });

  it('OpenSearch/DocumentDB도 대상이다', () => {
    const result = evaluateKmsEncryptionRule(
      graph([
        { id: 'os1', type: 'OPENSEARCH', position: { x: 0, y: 0 }, data: { label: 'OS' } },
        { id: 'doc1', type: 'DOCUMENT_DB', position: { x: 1, y: 0 }, data: { label: 'DocDB' } },
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['os1', 'doc1']);
  });

  /**
   * 14단계: Aurora/DynamoDB/Redshift/S3는 AWS가 기본적으로 항상 암호화하는 서비스로 바뀌어서
   * (2023~2026년 정책 변경), "KMS 연결 없음"이 "암호화 안 됨"을 뜻하지 않는다 — 영구 제외.
   * 회귀 방지용으로 고정해둔다.
   */
  it('Aurora/DynamoDB/Redshift/S3는 KMS가 없어도 해당 없음이다(이제 기본 암호화되는 서비스)', () => {
    const result = evaluateKmsEncryptionRule(
      graph([
        { id: 'aur1', type: 'AURORA', position: { x: 0, y: 0 }, data: { label: 'Aurora' } },
        { id: 'ddb1', type: 'DYNAMODB', position: { x: 1, y: 0 }, data: { label: 'DDB' } },
        { id: 'rs1', type: 'REDSHIFT', position: { x: 2, y: 0 }, data: { label: 'RS' } },
        { id: 's3-1', type: 'S3', position: { x: 3, y: 0 }, data: { label: 'S3' } },
      ]),
    );

    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });

  it('대상 타입이 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateKmsEncryptionRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
