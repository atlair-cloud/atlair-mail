import {
  fontFamilies,
  markTypes,
  textAligns,
  type BlockNode,
  type TemplateDocument,
  type TemplateTheme,
} from "./document.ts";
import { InvalidTemplateError } from "./errors.ts";
import { variableKey, variablePattern } from "./variables.ts";

export const maxNodes = 5_000;
export const maxDepth = 12;
export const maxTextLength = 20_000;
export const maxUrlLength = 2_000;

const hexColor = /^#[0-9a-fA-F]{6}$/;
const safeLink = /^(https?:\/\/|mailto:)\S+$/;
const safeImage = /^https?:\/\/\S+$/;
const singleVariable = new RegExp(`^\\{\\{\\s*${variableKey.source.slice(1, -1)}\\s*\\}\\}$`);

type Json = Record<string, unknown>;

const flowTypes = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
  "button",
  "image",
  "spacer",
]);

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

const absent = (value: unknown) => value === undefined || value === null;

class Checker {
  nodes = 0;

  fail(path: string, problem: string): never {
    throw new InvalidTemplateError(path, problem);
  }

  object(value: unknown, path: string) {
    if (!isObject(value)) this.fail(path, "must be an object");
    return value;
  }

  array(value: unknown, path: string, min = 0, max = Infinity) {
    if (!Array.isArray(value)) this.fail(path, "must be an array");
    if (value.length < min) this.fail(path, `needs at least ${min} item${min === 1 ? "" : "s"}`);
    if (value.length > max) this.fail(path, `allows at most ${max} items`);
    return value;
  }

  string(value: unknown, path: string, min: number, max: number) {
    if (typeof value !== "string") this.fail(path, "must be a string");
    if (value.length < min) this.fail(path, "must not be empty");
    if (value.length > max) this.fail(path, `must be at most ${max} characters`);
    return value;
  }

  integer(value: unknown, path: string, min: number, max: number) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      this.fail(path, `must be a whole number from ${min} to ${max}`);
    }
    return value;
  }

  oneOf(value: unknown, path: string, allowed: readonly string[]) {
    if (typeof value !== "string" || !allowed.includes(value)) this.fail(path, `must be one of ${allowed.join(", ")}`);
    return value;
  }

  optional(attrs: Json, key: string, path: string, check: (value: unknown, path: string) => unknown) {
    if (!absent(attrs[key])) check(attrs[key], `${path}.${key}`);
  }

  link(value: unknown, path: string, pattern: RegExp, kind: string) {
    const url = this.string(value, path, 1, maxUrlLength);
    if (singleVariable.test(url)) return;
    const withoutVariables = url.replace(variablePattern(), "x");
    if (!pattern.test(withoutVariables)) this.fail(path, `must be ${kind}, or a single {{variable}}`);
  }

  color(value: unknown, path: string) {
    if (typeof value !== "string" || !hexColor.test(value)) this.fail(path, "must be a hex color such as #1f2937");
  }

  count(path: string, depth: number) {
    this.nodes += 1;
    if (this.nodes > maxNodes) this.fail(path, `the template has more than ${maxNodes} nodes`);
    if (depth > maxDepth) this.fail(path, `is nested more than ${maxDepth} levels deep`);
  }

  attrs(node: Json, path: string) {
    return absent(node.attrs) ? {} : this.object(node.attrs, `${path}.attrs`);
  }

  textAlign(attrs: Json, path: string) {
    this.optional(attrs, "textAlign", `${path}.attrs`, (value, at) => this.oneOf(value, at, textAligns));
  }

  inline(content: unknown, path: string, depth: number) {
    if (absent(content)) return;
    this.array(content, path).forEach((item, index) => {
      const at = `${path}[${index}]`;
      const node = this.object(item, at);
      this.count(at, depth);
      switch (node.type) {
        case "text": {
          this.string(node.text, `${at}.text`, 1, maxTextLength);
          if (absent(node.marks)) break;
          this.array(node.marks, `${at}.marks`, 0, markTypes.length).forEach((value, markIndex) => {
            const markPath = `${at}.marks[${markIndex}]`;
            const mark = this.object(value, markPath);
            this.oneOf(mark.type, `${markPath}.type`, markTypes);
            if (mark.type === "link") {
              const attrs = this.object(mark.attrs, `${markPath}.attrs`);
              this.link(attrs.href, `${markPath}.attrs.href`, safeLink, "an http, https or mailto link");
            }
          });
          break;
        }
        case "hardBreak":
          break;
        case "variable": {
          const attrs = this.object(node.attrs, `${at}.attrs`);
          if (typeof attrs.name !== "string" || !variableKey.test(attrs.name)) {
            this.fail(`${at}.attrs.name`, "must be letters, numbers and underscores, up to 50 characters");
          }
          break;
        }
        default:
          this.fail(`${at}.type`, "must be text, hardBreak or variable");
      }
    });
  }

  paragraph(node: Json, path: string, depth: number) {
    this.textAlign(this.attrs(node, path), path);
    this.inline(node.content, `${path}.content`, depth + 1);
  }

  list(node: Json, path: string, depth: number) {
    this.array(node.content, `${path}.content`, 1).forEach((value, index) => {
      const at = `${path}.content[${index}]`;
      const item = this.object(value, at);
      this.count(at, depth + 1);
      if (item.type !== "listItem") this.fail(`${at}.type`, "must be listItem");
      this.array(item.content, `${at}.content`, 1).forEach((child, childIndex) => {
        const childPath = `${at}.content[${childIndex}]`;
        const childNode = this.object(child, childPath);
        this.count(childPath, depth + 2);
        if (childNode.type === "paragraph") this.paragraph(childNode, childPath, depth + 2);
        else if (childNode.type === "bulletList" || childNode.type === "orderedList") this.list(childNode, childPath, depth + 2);
        else this.fail(`${childPath}.type`, "must be paragraph, bulletList or orderedList");
      });
    });
  }

  flow(node: Json, path: string, depth: number) {
    const attrs = this.attrs(node, path);
    switch (node.type) {
      case "paragraph":
        return this.paragraph(node, path, depth);
      case "heading":
        this.integer(attrs.level, `${path}.attrs.level`, 1, 3);
        this.textAlign(attrs, path);
        return this.inline(node.content, `${path}.content`, depth + 1);
      case "bulletList":
      case "orderedList":
        return this.list(node, path, depth);
      case "blockquote":
        return this.array(node.content, `${path}.content`, 1).forEach((value, index) => {
          const at = `${path}.content[${index}]`;
          const child = this.object(value, at);
          this.count(at, depth + 1);
          if (child.type !== "paragraph") this.fail(`${at}.type`, "must be paragraph");
          this.paragraph(child, at, depth + 1);
        });
      case "horizontalRule":
        return;
      case "button":
        this.string(attrs.text, `${path}.attrs.text`, 1, 200);
        this.link(attrs.href, `${path}.attrs.href`, safeLink, "an http, https or mailto link");
        return this.textAlign(attrs, path);
      case "image":
        this.link(attrs.src, `${path}.attrs.src`, safeImage, "an http or https image address");
        this.optional(attrs, "alt", `${path}.attrs`, (value, at) => this.string(value, at, 0, 300));
        this.optional(attrs, "width", `${path}.attrs`, (value, at) => this.integer(value, at, 16, 1200));
        this.optional(attrs, "href", `${path}.attrs`, (value, at) => this.link(value, at, safeLink, "an http, https or mailto link"));
        return this.textAlign(attrs, path);
      case "spacer":
        this.integer(attrs.height, `${path}.attrs.height`, 4, 160);
        return;
    }
  }

  block(value: unknown, path: string, depth: number, allowed: "top" | "section" | "column") {
    const node = this.object(value, path);
    this.count(path, depth);
    const type = node.type;
    if (typeof type === "string" && flowTypes.has(type)) return this.flow(node, path, depth);
    if (type === "columns" && allowed !== "column") {
      return this.array(node.content, `${path}.content`, 2, 3).forEach((column, index) => {
        const at = `${path}.content[${index}]`;
        const columnNode = this.object(column, at);
        this.count(at, depth + 1);
        if (columnNode.type !== "column") this.fail(`${at}.type`, "must be column");
        this.array(columnNode.content, `${at}.content`).forEach((child, childIndex) =>
          this.block(child, `${at}.content[${childIndex}]`, depth + 2, "column"),
        );
      });
    }
    if (type === "section" && allowed === "top") {
      const attrs = this.attrs(node, path);
      this.optional(attrs, "backgroundColor", `${path}.attrs`, (color, at) => this.color(color, at));
      this.optional(attrs, "padding", `${path}.attrs`, (padding, at) => this.integer(padding, at, 0, 64));
      return this.array(node.content, `${path}.content`).forEach((child, index) =>
        this.block(child, `${path}.content[${index}]`, depth + 1, "section"),
      );
    }
    const where = allowed === "top" ? "" : ` inside a ${allowed}`;
    this.fail(`${path}.type`, `${typeof type === "string" ? type : "this block"} isn't allowed${where}`);
  }
}

export function parseDocument(input: unknown): TemplateDocument {
  const checker = new Checker();
  const doc = checker.object(input, "content");
  if (doc.type !== "doc") checker.fail("content.type", "must be doc");
  checker.array(doc.content, "content.content").forEach((block, index) =>
    checker.block(block, `content.content[${index}]`, 1, "top"),
  );
  return { type: "doc", content: doc.content as BlockNode[] };
}

export function parseTheme(input: unknown): TemplateTheme {
  if (absent(input)) return {};
  const checker = new Checker();
  const theme = checker.object(input, "theme");
  for (const key of ["brandColor", "textColor", "backgroundColor", "contentColor"] as const) {
    checker.optional(theme, key, "theme", (value, at) => checker.color(value, at));
  }
  checker.optional(theme, "fontFamily", "theme", (value, at) => checker.oneOf(value, at, fontFamilies));
  checker.optional(theme, "width", "theme", (value, at) => checker.integer(value, at, 480, 720));
  return theme as TemplateTheme;
}
