"use client";

import type { ValidationRuleCatalogItem } from "@nangman/shared-types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getValidationRuleCatalog } from "./api";

/** 인증이 필요 없는 참조 데이터라 랜딩(비로그인)·대시보드 양쪽에서 그대로 쓸 수 있다. */
export function useValidationRuleCatalog(): UseQueryResult<ValidationRuleCatalogItem[], Error> {
  return useQuery({ queryKey: ["validation-rule-catalog"], queryFn: getValidationRuleCatalog });
}
