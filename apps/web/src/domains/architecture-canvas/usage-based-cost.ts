/**
 * 백엔드(apps/api)의 비용 계산도 이 공식이 그대로 필요해서 packages/shared-types로 옮겼다. 이
 * 파일을 import하던 코드가 전부 그대로 동작하도록 여기서는 다시 내보내기만 한다.
 */
export {
  ALB_FIXED_MONTHLY_USD,
  computeAlbCost,
  computeCdnCost,
  DEFAULT_ALB_REQUESTS_PER_CONNECTION,
  DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB,
  KB_PER_GB,
  SECONDS_PER_MONTH,
  type AlbCostInput,
  type AlbCostResult,
  type CdnCostInput,
  type CdnCostResult,
} from "@nangman/shared-types";
