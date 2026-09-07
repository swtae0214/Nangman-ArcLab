/**
 * AWS 서비스가 아닌, 워드/파워포인트의 "개체 묶기"와 같은 범용 그룹을 나타내는 아이콘.
 * aws-react-icons의 다른 아이콘들과 같은 형태(FC<{ size?: number|string }>)로 맞춰서
 * COMPONENT_META 표에 그대로 끼워 넣을 수 있게 했다.
 */
export function GenericGroupIcon({ size = 24 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="2.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="13.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="13.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
