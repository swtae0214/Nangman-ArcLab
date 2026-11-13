/**
 * AWS 서비스가 아닌, 캔버스에 자유롭게 놓는 텍스트 박스(주석)를 나타내는 아이콘.
 * GenericGroupIcon과 같은 형태(FC<{ size?: number|string }>)로 맞춰서 COMPONENT_META에 끼워 넣는다.
 */
export function TextBoxIcon({ size = 24 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 9H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 12.5H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 16H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
