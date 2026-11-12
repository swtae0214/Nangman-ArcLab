"use client";

import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import { useState, type RefObject } from "react";

interface ExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>;
  fileName: string;
}

// 10단계: 캡처 결과에 확대/축소·미니맵 같은 에디터 UI까지 찍혀서 "불필요한 정보"라는 피드백을 받았다.
const EXCLUDED_CLASS_NAMES = ["react-flow__controls", "react-flow__minimap"];
const CROP_PADDING_PX = 24;
const EXPORT_PIXEL_RATIO = 2;

function shouldCaptureNode(node: HTMLElement): boolean {
  if (typeof node.classList?.contains !== "function") return true;
  return !EXCLUDED_CLASS_NAMES.some((className) => node.classList.contains(className));
}

/**
 * 10단계: 연결선(path)은 색이 전부 외부 스타일시트 클래스(.react-flow__edge-path)에서만 오는데,
 * html-to-image는 <svg> 내부는 엘리먼트별로 계산된 스타일을 하나하나 복사하지 않고 통째로 native
 * cloneNode만 떠버려서, 내보낸 이미지에선 그 색이 다 날아가 선이 안 보였다. 캡처 직전에 실제로
 * "지금 화면에 계산된" stroke 색/굵기를 인라인 style로 잠깐 박아 넣었다가, 캡처가 끝나면 원래대로
 * 되돌린다 — 라이트/다크 모드든 선택 상태든 화면에 보이는 그대로 내보내진다.
 */
function patchEdgeStrokeStyles(container: HTMLElement): () => void {
  const edgePaths = container.querySelectorAll<SVGPathElement>(".react-flow__edge-path");
  const restores: (() => void)[] = [];
  edgePaths.forEach((path) => {
    const computed = window.getComputedStyle(path);
    const stroke = computed.stroke;
    const strokeWidth = computed.strokeWidth;
    const previousStroke = path.style.stroke;
    const previousStrokeWidth = path.style.strokeWidth;
    path.style.stroke = stroke;
    path.style.strokeWidth = strokeWidth;
    restores.push(() => {
      path.style.stroke = previousStroke;
      path.style.strokeWidth = previousStrokeWidth;
    });
  });
  return () => restores.forEach((restore) => restore());
}

/** 7단계: 지금 보이는 캔버스 화면을 그대로 PNG/PDF로 내려받는다 (전체 팬 가능 영역이 아니라 현재 보이는 부분). */
export function ExportButton({ targetRef, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const captureDataUrl = async (): Promise<string | null> => {
    const container = targetRef.current;
    if (!container) return null;

    const restoreEdgeStrokes = patchEdgeStrokeStyles(container);
    let fullCanvas: HTMLCanvasElement;
    try {
      fullCanvas = await toCanvas(container, {
        backgroundColor: "#ffffff",
        pixelRatio: EXPORT_PIXEL_RATIO,
        filter: shouldCaptureNode,
      });
    } finally {
      restoreEdgeStrokes();
    }

    // 레이어 개념이 아직 없어서 "실제 노드가 차지하는 범위"로만 대신 자른다 — 빈 여백을 크게 줄여준다.
    const containerRect = container.getBoundingClientRect();
    const nodeElements = container.querySelectorAll<HTMLElement>(".react-flow__node");
    if (nodeElements.length === 0) return fullCanvas.toDataURL("image/png");

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodeElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      minX = Math.min(minX, rect.left - containerRect.left);
      minY = Math.min(minY, rect.top - containerRect.top);
      maxX = Math.max(maxX, rect.right - containerRect.left);
      maxY = Math.max(maxY, rect.bottom - containerRect.top);
    });

    minX = Math.max(0, minX - CROP_PADDING_PX);
    minY = Math.max(0, minY - CROP_PADDING_PX);
    maxX = Math.min(containerRect.width, maxX + CROP_PADDING_PX);
    maxY = Math.min(containerRect.height, maxY + CROP_PADDING_PX);

    const cropWidth = (maxX - minX) * EXPORT_PIXEL_RATIO;
    const cropHeight = (maxY - minY) * EXPORT_PIXEL_RATIO;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return fullCanvas.toDataURL("image/png");

    ctx.drawImage(
      fullCanvas,
      minX * EXPORT_PIXEL_RATIO,
      minY * EXPORT_PIXEL_RATIO,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );
    return cropCanvas.toDataURL("image/png");
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
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {isExporting ? "내보내는 중..." : "PNG"}
      </button>
      <button
        type="button"
        onClick={() => void handleExportPdf()}
        disabled={isExporting}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        PDF
      </button>
    </div>
  );
}
