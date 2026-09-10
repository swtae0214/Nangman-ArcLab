const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

/** "3분 전", "1시간 전"처럼 상대 시간을 한국어로 표기한다. 별도 날짜 라이브러리 없이 브라우저
 *  내장 Intl.RelativeTimeFormat만으로 충분해서 새 의존성을 추가하지 않았다. */
export function formatRelativeTimeKo(isoString: string): string {
  const diffSec = (Date.parse(isoString) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

  for (const { unit, seconds } of UNITS) {
    if (Math.abs(diffSec) >= seconds || unit === "second") {
      return rtf.format(Math.round(diffSec / seconds), unit);
    }
  }
  return rtf.format(0, "second");
}
