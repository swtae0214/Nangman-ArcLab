/**
 * 백엔드(apps/api)의 시뮬레이션/비용 계산도 이 전파 로직이 그대로 필요해서(두 쪽이 서로 다른
 * 계산을 해서 숫자가 어긋나는 걸 막으려고) packages/shared-types로 옮겼다. 이 파일을 import하던
 * 코드가 전부 그대로 동작하도록 여기서는 다시 내보내기만 한다.
 */
export {
  computeNodeRps,
  detectTrafficCycles,
  DEFAULT_CDN_CACHE_HIT_RATIO_PERCENT,
  getDefaultCallsPerRequest,
  inferEdgeKind,
  type NodeRpsOverrideMismatch,
  type NodeRpsResult,
  type TrafficEdgeKind,
} from "@nangman/shared-types";
