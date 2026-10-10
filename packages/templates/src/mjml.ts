import type {
  BlockNode,
  ColumnsNode,
  FlowNode,
  InlineNode,
  ListNode,
  Mark,
  ParagraphNode,
  TemplateDocument,
  TemplateTheme,
} from "./document.ts";
import type { Fill } from "./variables.ts";

export const defaultTheme = {
  brandColor: "#111827",
  textColor: "#1f2937",
  backgroundColor: "#f4f4f5",
  contentColor: "#ffffff",
  fontFamily: "sans",
  width: 600,
} as const satisfies Required<TemplateTheme>;

const fontStacks = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const headingSizes = { 1: 28, 2: 22, 3: 18 };
const gutter = 24;

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface RenderContext {
  fill: Fill;
  checkLink: (url: string, kind: "link" | "image") => string;
  theme: Required<TemplateTheme>;
}

const attributes = (values: Record<string, string | number | null | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ` ${key}="${escapeHtml(String(value))}"`)
    .join("");

function wrapMark(html: string, mark: Mark, context: RenderContext) {
  switch (mark.type) {
    case "bold":
      return `<strong>${html}</strong>`;
    case "italic":
      return `<em>${html}</em>`;
    case "underline":
      return `<u>${html}</u>`;
    case "strike":
      return `<s>${html}</s>`;
    case "code":
      return `<code style="font-family:${escapeHtml(fontStacks.mono)};background:#f4f4f5;padding:1px 4px;border-radius:3px;font-size:0.9em">${html}</code>`;
    case "link": {
      const href = context.checkLink(context.fill(mark.attrs?.href ?? ""), "link");
      return `<a href="${escapeHtml(href)}" style="color:${context.theme.brandColor};text-decoration:underline">${html}</a>`;
    }
  }
}

const markOrder: Mark["type"][] = ["code", "strike", "underline", "italic", "bold", "link"];

export function inlineHtml(content: InlineNode[] | undefined, context: RenderContext) {
  return (content ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return "<br />";
      if (node.type === "variable") return escapeHtml(context.fill(`{{${node.attrs.name}}}`));
      const marks = [...(node.marks ?? [])].sort((a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type));
      return marks.reduce((html, mark) => wrapMark(html, mark, context), escapeHtml(context.fill(node.text)));
    })
    .join("");
}

const paragraphHtml = (node: ParagraphNode, context: RenderContext, style = "margin:0") =>
  `<p style="${style}">${inlineHtml(node.content, context) || "&nbsp;"}</p>`;

function listHtml(node: ListNode, context: RenderContext): string {
  const tag = node.type === "bulletList" ? "ul" : "ol";
  const items = node.content
    .map((item) => {
      const inner = item.content
        .map((child) => (child.type === "paragraph" ? inlineHtml(child.content, context) : listHtml(child, context)))
        .join("<br />");
      return `<li style="margin:0 0 4px">${inner}</li>`;
    })
    .join("");
  return `<${tag} style="margin:0;padding-left:24px">${items}</${tag}>`;
}

const textPadding = `0 ${gutter}px 12px`;

function flowMjml(node: FlowNode, context: RenderContext): string {
  const { theme } = context;
  switch (node.type) {
    case "paragraph":
      return `<mj-text${attributes({ align: node.attrs?.textAlign, padding: textPadding })}>${paragraphHtml(node, context)}</mj-text>`;
    case "heading": {
      const size = headingSizes[node.attrs.level];
      const tag = `h${node.attrs.level}`;
      const style = `margin:0;font-size:${size}px;line-height:1.25;font-weight:700;color:${theme.textColor}`;
      return `<mj-text${attributes({ align: node.attrs.textAlign, padding: `8px ${gutter}px 12px` })}><${tag} style="${style}">${inlineHtml(node.content, context) || "&nbsp;"}</${tag}></mj-text>`;
    }
    case "bulletList":
    case "orderedList":
      return `<mj-text${attributes({ padding: textPadding })}>${listHtml(node, context)}</mj-text>`;
    case "blockquote": {
      const quote = node.content.map((paragraph) => paragraphHtml(paragraph, context, "margin:0 0 8px")).join("");
      return `<mj-text${attributes({ padding: textPadding })}><blockquote style="margin:0;padding:0 0 0 16px;border-left:3px solid #e5e7eb;color:#4b5563">${quote}</blockquote></mj-text>`;
    }
    case "horizontalRule":
      return `<mj-divider />`;
    case "button": {
      const href = context.checkLink(context.fill(node.attrs.href), "link");
      return `<mj-button${attributes({ href, align: node.attrs.textAlign ?? "left" })}>${escapeHtml(context.fill(node.attrs.text))}</mj-button>`;
    }
    case "image": {
      const src = context.checkLink(context.fill(node.attrs.src), "image");
      const href = node.attrs.href ? context.checkLink(context.fill(node.attrs.href), "link") : null;
      const width = node.attrs.width ? Math.min(node.attrs.width, theme.width - gutter * 2) : null;
      return `<mj-image${attributes({
        src,
        alt: node.attrs.alt ? context.fill(node.attrs.alt) : "",
        href,
        width: width ? `${width}px` : null,
        align: node.attrs.textAlign ?? "center",
      })} />`;
    }
    case "spacer":
      return `<mj-spacer height="${node.attrs.height}px" />`;
  }
}

interface SectionPadding {
  top: number;
  bottom: number;
}

const columnsHtml = (node: ColumnsNode, context: RenderContext) =>
  node.content.map((column) => `<mj-column>${column.content.map((child) => flowMjml(child, context)).join("")}</mj-column>`).join("");

function groupMjml(blocks: (FlowNode | ColumnsNode)[], context: RenderContext, background: string | null, edges: SectionPadding) {
  const sections: string[] = [];
  let flow: FlowNode[] = [];
  const flush = () => {
    if (flow.length === 0) return;
    sections.push(`<mj-column>${flow.map((node) => flowMjml(node, context)).join("")}</mj-column>`);
    flow = [];
  };
  for (const block of blocks) {
    if (block.type === "columns") {
      flush();
      sections.push(columnsHtml(block, context));
    } else {
      flow.push(block);
    }
  }
  flush();
  return sections
    .map((columns, index) => {
      const padding = `${index === 0 ? edges.top : 0}px 0 ${index === sections.length - 1 ? edges.bottom : 0}px`;
      return `<mj-section${attributes({ "background-color": background, padding })}>${columns}</mj-section>`;
    })
    .join("");
}

export function documentMjml(doc: TemplateDocument, context: RenderContext, title: string) {
  const { theme } = context;
  const font = fontStacks[theme.fontFamily];
  const runs: (BlockNode[] | BlockNode)[] = [];
  for (const block of doc.content) {
    const last = runs.at(-1);
    if (block.type === "section") runs.push(block);
    else if (Array.isArray(last)) last.push(block);
    else runs.push([block]);
  }
  const body = runs
    .map((run, index) => {
      const edges = { top: index === 0 ? gutter : 0, bottom: index === runs.length - 1 ? 12 : 0 };
      if (Array.isArray(run)) return groupMjml(run as (FlowNode | ColumnsNode)[], context, theme.contentColor, edges);
      if (run.type !== "section") return "";
      const inner = run.attrs?.padding ?? 16;
      const wrapper = attributes({
        "background-color": run.attrs?.backgroundColor ?? theme.contentColor,
        padding: `${inner + edges.top}px 0 ${inner + edges.bottom}px`,
      });
      return `<mj-wrapper${wrapper}>${groupMjml(run.content, context, null, { top: 0, bottom: 0 })}</mj-wrapper>`;
    })
    .join("");

  const head = [
    `<mj-title>${escapeHtml(title)}</mj-title>`,
    "<mj-attributes>",
    `<mj-all font-family="${escapeHtml(font)}" />`,
    `<mj-text font-size="16px" line-height="1.6" color="${theme.textColor}" />`,
    `<mj-button background-color="${theme.brandColor}" color="#ffffff" border-radius="4px" font-size="15px" font-weight="600" inner-padding="12px 20px" padding="8px ${gutter}px 16px" />`,
    `<mj-image padding="8px ${gutter}px 16px" />`,
    `<mj-divider border-color="#e5e7eb" border-width="1px" padding="12px ${gutter}px" />`,
    "</mj-attributes>",
    `<mj-style>a { color: ${theme.brandColor}; }</mj-style>`,
  ].join("");

  return `<mjml><mj-head>${head}</mj-head><mj-body${attributes({ "background-color": theme.backgroundColor, width: `${theme.width}px` })}>${body}</mj-body></mjml>`;
}
