"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef } from "react";
import { getSharedArchitecture } from "@/lib/api";
import { ArchitectureCanvas } from "./ArchitectureCanvas";
import { ExportButton } from "./ExportButton";

const NOOP_GRAPH_CHANGE = () => {};

/** 7단계: 공유 링크(share_token)로 접속한 익명 방문자가 보는 읽기 전용 화면. */
export function SharedArchitectureView({ shareToken }: { shareToken: string }) {
  const query = useQuery({
    queryKey: ["shared-architectures", shareToken],
    queryFn: () => getSharedArchitecture(shareToken),
  });
  const exportContainerRef = useRef<HTMLDivElement>(null);

  if (query.isLoading) {
    return <div className="p-8">불러오는 중...</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-8">
        <p className="text-red-600">{query.error?.message ?? "공유된 아키텍처를 찾을 수 없습니다."}</p>
        <Link href="/architectures" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{query.data.name}</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">읽기 전용 공유 링크</span>
        </div>
        <ExportButton targetRef={exportContainerRef} fileName={query.data.name} />
      </header>
      <div className="min-h-0 flex-1">
        <ArchitectureCanvas
          initialGraph={query.data.graph}
          onGraphChange={NOOP_GRAPH_CHANGE}
          exportContainerRef={exportContainerRef}
          readOnly
        />
      </div>
    </div>
  );
}
