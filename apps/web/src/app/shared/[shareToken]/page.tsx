import { SharedArchitectureView } from "@/domains/architecture-canvas/components/SharedArchitectureView";

export default async function SharedArchitecturePage(props: PageProps<"/shared/[shareToken]">) {
  const { shareToken } = await props.params;
  return <SharedArchitectureView shareToken={shareToken} />;
}
