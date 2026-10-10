export const textAligns = ["left", "center", "right"] as const;
export type TextAlign = (typeof textAligns)[number];

export const markTypes = ["bold", "italic", "underline", "strike", "code", "link"] as const;
export type MarkType = (typeof markTypes)[number];

export interface Mark {
  type: MarkType;
  attrs?: { href?: string };
}

export interface TextNode {
  type: "text";
  text: string;
  marks?: Mark[];
}

export interface HardBreakNode {
  type: "hardBreak";
}

export interface VariableNode {
  type: "variable";
  attrs: { name: string };
}

export type InlineNode = TextNode | HardBreakNode | VariableNode;

export interface ParagraphNode {
  type: "paragraph";
  attrs?: { textAlign?: TextAlign | null };
  content?: InlineNode[];
}

export interface HeadingNode {
  type: "heading";
  attrs: { level: 1 | 2 | 3; textAlign?: TextAlign | null };
  content?: InlineNode[];
}

export interface ListItemNode {
  type: "listItem";
  content: (ParagraphNode | ListNode)[];
}

export interface ListNode {
  type: "bulletList" | "orderedList";
  content: ListItemNode[];
}

export interface BlockquoteNode {
  type: "blockquote";
  content: ParagraphNode[];
}

export interface HorizontalRuleNode {
  type: "horizontalRule";
}

export interface ButtonNode {
  type: "button";
  attrs: { text: string; href: string; textAlign?: TextAlign | null };
}

export interface ImageNode {
  type: "image";
  attrs: { src: string; alt?: string | null; width?: number | null; href?: string | null; textAlign?: TextAlign | null };
}

export interface SpacerNode {
  type: "spacer";
  attrs: { height: number };
}

export type FlowNode =
  | ParagraphNode
  | HeadingNode
  | ListNode
  | BlockquoteNode
  | HorizontalRuleNode
  | ButtonNode
  | ImageNode
  | SpacerNode;

export interface ColumnNode {
  type: "column";
  content: FlowNode[];
}

export interface ColumnsNode {
  type: "columns";
  content: ColumnNode[];
}

export interface SectionNode {
  type: "section";
  attrs?: { backgroundColor?: string | null; padding?: number | null };
  content: (FlowNode | ColumnsNode)[];
}

export type BlockNode = FlowNode | ColumnsNode | SectionNode;

export interface TemplateDocument {
  type: "doc";
  content: BlockNode[];
}

export const fontFamilies = ["sans", "serif", "mono"] as const;
export type FontFamily = (typeof fontFamilies)[number];

export interface TemplateTheme {
  brandColor?: string;
  textColor?: string;
  backgroundColor?: string;
  contentColor?: string;
  fontFamily?: FontFamily;
  width?: number;
}

export const variableTypes = ["string", "number"] as const;
export type VariableType = (typeof variableTypes)[number];

export interface VariableDefinition {
  key: string;
  type: VariableType;
  fallback?: string | number;
}

export type VariableValues = Record<string, unknown>;
