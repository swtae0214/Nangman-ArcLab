"use client";

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { useState, type RefObject } from "react";

interface ExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>;
  fileName: string;
}

/** 7단계: 지금 보이는 캔버스 화면을 그대로 PNG/PDF로 내려받는다 (전체 팬 가능 영역이 아니라 현재 보이는 부분). */
export function ExportButton({ targetRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const captureDataUrl = async (): Promise<string | null> => {
    if (!targetRef.current) return null;
    return toPng(targetRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const handleExportPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await captureDataUrl();
      if (dataUrl) downloadDataUrl(dataUrl, `${fileName}.png`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await captureDataUrl();
      if (!dataUrl) return;

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
        image.src = dataUrl;
      });

      const pdf = new jsPDF({
        orientation: image.width >= image.height ? "landscape" : "portrait",
        unit: "px",
        format: [image.width, image.height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, image.width, image.height);
      pdf.save(`${fileName}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handleExportPng()}
        disabled={isExporting}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40"
      >
        {isExporting ? "내보내는 중..." : "PNG"}
      </button>
      <button
        type="button"
        onClick={() => void handleExportPdf()}
        disabled={isExporting}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40"
      >
        PDF
      </button>
    </div>
  );
}
