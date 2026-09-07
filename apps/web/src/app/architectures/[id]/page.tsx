import { ArchitectureEditor } from "@/domains/architecture-canvas/components/ArchitectureEditor";

export default async function ArchitectureEditorPage(props: PageProps<"/architectures/[id]">) {
  const { id } = await props.params;
  return <ArchitectureEditor id={id} />;
}
