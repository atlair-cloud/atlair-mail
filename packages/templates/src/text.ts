import type { BlockNode, FlowNode, InlineNode, ListNode, TemplateDocument } from "./document.ts";
import type { RenderContext } from "./mjml.ts";

function inlineText(content: InlineNode[] | undefined, context: RenderContext) {
  return (content ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type === "variable") return context.fill(`{{${node.attrs.name}}}`);
      const text = context.fill(node.text);
      const link = node.marks?.find((mark) => mark.type === "link");
      if (!link) return text;
      const href = context.checkLink(context.fill(link.attrs?.href ?? ""), "link");
      return href === text || href === `mailto:${text}` ? text : `${text} (${href})`;
    })
    .join("");
}

function listText(node: ListNode, context: RenderContext, indent = ""): string {
  return node.content
    .map((item, index) => {
      const bullet = node.type === "bulletList" ? "-" : `${index + 1}.`;
      return item.content
        .map((child, childIndex) =>
          child.type === "paragraph"
            ? `${childIndex === 0 ? `${indent}${bullet} ` : `${indent}  `}${inlineText(child.content, context)}`
            : listText(child, context, `${indent}  `),
        )
        .join("\n");
    })
    .join("\n");
}

function flowText(node: FlowNode, context: RenderContext): string | null {
  switch (node.type) {
    case "paragraph":
      return inlineText(node.content, context);
    case "heading":
      return inlineText(node.content, context);
    case "bulletList":
    case "orderedList":
      return listText(node, context);
    case "blockquote":
      return node.content.map((paragraph) => `> ${inlineText(paragraph.content, context)}`).join("\n");
    case "horizontalRule":
      return "---";
    case "button":
      return `${context.fill(node.attrs.text)}: ${context.checkLink(context.fill(node.attrs.href), "link")}`;
    case "image":
      return node.attrs.alt ? `[${context.fill(node.attrs.alt)}]` : null;
    case "spacer":
      return null;
  }
}

function blockText(node: BlockNode, context: RenderContext): (string | null)[] {
  if (node.type === "section") return node.content.flatMap((child) => blockText(child, context));
  if (node.type === "columns") return node.content.flatMap((column) => column.content.map((child) => flowText(child, context)));
  return [flowText(node, context)];
}

export function documentText(doc: TemplateDocument, context: RenderContext) {
  return doc.content
    .flatMap((block) => blockText(block, context))
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join("\n\n");
}
