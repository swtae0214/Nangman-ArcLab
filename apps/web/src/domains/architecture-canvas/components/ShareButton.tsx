"use client";

import { useState } from "react";
import { useShareArchitecture, useUnshareArchitecture } from "../hooks/useShare";

interface ShareButtonProps {
  architectureId: string;
  isPublic: boolean;
  shareToken?: string;
}

/** 7단계: 공유 링크 발급/해제. 링크는 이 브라우저가 보고 있는 주소(origin) 기준으로 만든다. */
export function ShareButton({ architectureId, isPublic, shareToken }: ShareButtonProps) {
  const share = useShareArchitecture(architectureId);
  const unshare = useUnshareArchitecture(architectureId);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined" && shareToken ? `${window.location.origin}/shared/${shareToken}` : undefined;

  const handleCopy = () => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isPublic && shareUrl) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <input readOnly value={shareUrl} className="w-40 rounded border border-gray-300 bg-gray-50 px-1.5 py-1 text-[11px]" />
        <button type="button" onClick={handleCopy} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
          {copied ? "복사됨" : "복사"}
        </button>
        <button
          type="button"
          onClick={() => unshare.mutate()}
          disabled={unshare.isPending}
          className="rounded border border-gray-300 px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          공유 해제
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => share.mutate()}
      disabled={share.isPending}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40"
    >
      {share.isPending ? "공유 링크 만드는 중..." : "공유"}
    </button>
  );
}
