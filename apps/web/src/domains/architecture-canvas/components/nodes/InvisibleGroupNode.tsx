/**
 * GENERIC_GROUP 전용 렌더러. 워드/파워포인트의 "개체 묶기"처럼 화면에 아무것도 그리지 않고,
 * 여러 노드를 하나의 상위 부모로 묶어서 함께 선택/이동되게만 만드는 순수 논리적 컨테이너다.
 * 테두리·아이콘·이름표를 일부러 전부 없앴다 — ASG/Multi-AZ/Multi-Region처럼 실제로 뭔가를
 * 의미하는 그룹은 계속 GroupNode(점선 박스)로 보여주고, 이 컴포넌트만 안 보이게 둔다.
 */
export function InvisibleGroupNode() {
  return <div className="h-full w-full" />;
}
