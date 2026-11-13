import type { ComponentType } from "@nangman/shared-types";
import type { NodeTypes } from "@xyflow/react";
import { COMPONENT_META } from "../component-meta";
import { LOGICAL_GROUP_TYPES } from "../component-meta";
import { GroupNode } from "./nodes/GroupNode";
import { InvisibleGroupNode } from "./nodes/InvisibleGroupNode";
import { LeafNode } from "./nodes/LeafNode";
import { LogicalGroupNode } from "./nodes/LogicalGroupNode";
import { TextBoxNode } from "./nodes/TextBoxNode";

const LOGICAL_GROUP_TYPE_SET = new Set<ComponentType>(LOGICAL_GROUP_TYPES);

function pickRenderer(type: ComponentType) {
  if (type === "GENERIC_GROUP") return InvisibleGroupNode;
  if (type === "TEXT_BOX") return TextBoxNode;
  if (LOGICAL_GROUP_TYPE_SET.has(type)) return LogicalGroupNode;
  return COMPONENT_META[type].isGroup ? GroupNode : LeafNode;
}

export const nodeTypes: NodeTypes = Object.fromEntries(
  (Object.keys(COMPONENT_META) as ComponentType[]).map((type) => [type, pickRenderer(type)]),
);
