"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useComponentPresets, useNodeCapacityPreview } from "../hooks/useCapacityCalculator";

const formSchema = z.object({
  presetCode: z.string().min(1, "프리셋을 선택하세요."),
  instanceCount: z.number().int().min(1, "1대 이상이어야 해요."),
  expectedRps: z.number().min(0, "0 이상이어야 해요."),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * 4주차 범위: 그래프 전체를 도는 시뮬레이션(5주차 예정) 없이도, 컴포넌트 하나의 M/M/c 계산이
 * 실제로 맞게 동작하는지 바로 확인해볼 수 있는 단일 노드 용량 계산기.
 */
export function CapacityCalculator() {
  const presetsQuery = useComponentPresets();
  const preview = useNodeCapacityPreview();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { presetCode: "", instanceCount: 1, expectedRps: 0 },
  });

  const onSubmit = handleSubmit((values) => {
    preview.mutate(values);
  });

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <p className="text-xs text-gray-500">
        컴포넌트 하나(웹서버/DB/캐시 등)의 예상 지연시간·처리량을 M/M/c 큐잉 모델로 미리 계산해봐요. 아직 아키텍처
        전체를 도는 시뮬레이션은 아니에요 (5주차 예정).
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-600">
          프리셋
          <select {...register("presetCode")} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">선택하세요</option>
            {presetsQuery.data?.map((preset) => (
              <option key={preset.code} value={preset.code}>
                {preset.displayName} (~{preset.serviceRateRps} RPS/대)
              </option>
            ))}
          </select>
          {errors.presetCode && <span className="mt-0.5 block text-[11px] text-red-500">{errors.presetCode.message}</span>}
        </label>

        <label className="text-xs font-medium text-gray-600">
          인스턴스 수
          <input
            type="number"
            min={1}
            {...register("instanceCount", { valueAsNumber: true })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          {errors.instanceCount && (
            <span className="mt-0.5 block text-[11px] text-red-500">{errors.instanceCount.message}</span>
          )}
        </label>

        <label className="text-xs font-medium text-gray-600">
          예상 RPS
          <input
            type="number"
            min={0}
            step="any"
            {...register("expectedRps", { valueAsNumber: true })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          {errors.expectedRps && <span className="mt-0.5 block text-[11px] text-red-500">{errors.expectedRps.message}</span>}
        </label>

        <button
          type="submit"
          disabled={preview.isPending}
          className="mt-1 rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          {preview.isPending ? "계산 중..." : "계산하기"}
        </button>
      </form>

      {preview.error && <p className="text-xs text-red-600">{preview.error.message}</p>}

      {preview.data && (
        <div
          className={`rounded-md border p-3 text-sm ${
            preview.data.isSaturated ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"
          }`}
        >
          {preview.data.isSaturated ? (
            <p className="font-semibold text-red-700">⚠️ 처리 능력을 초과했어요 (포화 상태)</p>
          ) : (
            <p className="font-semibold text-emerald-700">정상 처리 가능</p>
          )}
          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
            <dt>이용률(ρ)</dt>
            <dd>{(preview.data.rho * 100).toFixed(1)}%</dd>
            <dt>평균 지연시간</dt>
            <dd>{preview.data.avgLatencyMs === null ? "계산 불가(포화)" : `${preview.data.avgLatencyMs.toFixed(1)}ms`}</dd>
            <dt>처리량</dt>
            <dd>{preview.data.throughputRps.toFixed(1)} RPS</dd>
            <dt>대기 확률</dt>
            <dd>{(preview.data.waitProbability * 100).toFixed(1)}%</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
