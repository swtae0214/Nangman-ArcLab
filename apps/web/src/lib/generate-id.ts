/**
 * crypto.randomUUID()는 "안전한 컨텍스트"(HTTPS 또는 localhost)에서만 존재하는 브라우저
 * 보안 제한이 있다 — 와이어가드 같은 사설망 안에서 HTTPS 없이(http://IP:포트) 쓰는 배포에서는
 * 이 함수 자체가 없어서 노드/엣지를 만들 때마다 TypeError로 캔버스 조작이 전부 깨졌었다.
 * crypto.getRandomValues()는 그런 제한이 없으므로, 그걸로 직접 UUID v4를 만든다.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // crypto 자체가 없는 극히 예외적인 환경을 위한 최후의 수단.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
