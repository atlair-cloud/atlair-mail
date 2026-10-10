import { variableTypes, type BlockNode, type TemplateDocument, type VariableDefinition, type VariableValues } from "./document.ts";
import { InvalidTemplateError, TemplateVariablesError } from "./errors.ts";

export const variableKey = /^[A-Za-z0-9_]{1,50}$/;
export const maxVariables = 50;
export const maxVariableValueLength = 2_000;

export const variablePattern = () => /\{\{\s*([A-Za-z0-9_]{1,50})\s*\}\}/g;

export function parseVariables(input: unknown): VariableDefinition[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new InvalidTemplateError("variables", "must be an array");
  if (input.length > maxVariables) throw new InvalidTemplateError("variables", `allows at most ${maxVariables} variables`);
  const seen = new Set<string>();
  return input.map((value, index) => {
    const path = `variables[${index}]`;
    if (typeof value !== "object" || value === null) throw new InvalidTemplateError(path, "must be an object");
    const { key, type, fallback } = value as Record<string, unknown>;
    if (typeof key !== "string" || !variableKey.test(key)) {
      throw new InvalidTemplateError(`${path}.key`, "must be letters, numbers and underscores, up to 50 characters");
    }
    if (seen.has(key)) throw new InvalidTemplateError(`${path}.key`, `${key} is declared twice`);
    seen.add(key);
    if (typeof type !== "string" || !(variableTypes as readonly string[]).includes(type)) {
      throw new InvalidTemplateError(`${path}.type`, "must be string or number");
    }
    if (fallback === undefined || fallback === null) return { key, type: type as VariableDefinition["type"] };
    if (!acceptsValue(type as VariableDefinition["type"], fallback)) {
      throw new InvalidTemplateError(`${path}.fallback`, `must be a ${type}${type === "string" ? ` up to ${maxVariableValueLength} characters` : ""}`);
    }
    return { key, type: type as VariableDefinition["type"], fallback: fallback as string | number };
  });
}

function acceptsValue(type: VariableDefinition["type"], value: unknown) {
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === "string" && value.length <= maxVariableValueLength;
}

function keysIn(text: string, found: Set<string>) {
  for (const match of text.matchAll(variablePattern())) found.add(match[1]!);
}

function collect(value: unknown, found: Set<string>) {
  if (typeof value === "string") return keysIn(value, found);
  if (Array.isArray(value)) return value.forEach((item) => collect(item, found));
  if (typeof value !== "object" || value === null) return;
  const node = value as { type?: unknown; attrs?: { name?: unknown } };
  if (node.type === "variable" && typeof node.attrs?.name === "string") found.add(node.attrs.name);
  Object.values(value).forEach((item) => collect(item, found));
}

export function usedVariables(subject: string, content: TemplateDocument | BlockNode[]) {
  const found = new Set<string>();
  keysIn(subject, found);
  collect(content, found);
  return [...found].sort();
}

export function checkDeclared(used: string[], declared: VariableDefinition[]) {
  const keys = new Set(declared.map((definition) => definition.key));
  const undeclared = used.filter((key) => !keys.has(key));
  if (undeclared.length > 0) {
    throw new InvalidTemplateError("variables", `declare ${undeclared.join(", ")}, used in the template`);
  }
}

export type Fill = (text: string) => string;

export function resolveValues(definitions: VariableDefinition[], values: VariableValues, strict: boolean) {
  const resolved = new Map<string, string>();
  const problems = { missing: [] as string[], unknown: [] as string[], invalid: [] as string[] };
  const declared = new Set(definitions.map((definition) => definition.key));
  for (const key of Object.keys(values)) if (!declared.has(key)) problems.unknown.push(key);
  for (const definition of definitions) {
    const value = values[definition.key];
    if (value === undefined || value === null) {
      if (definition.fallback !== undefined) resolved.set(definition.key, String(definition.fallback));
      else if (strict) problems.missing.push(definition.key);
      continue;
    }
    if (!acceptsValue(definition.type, value)) problems.invalid.push(definition.key);
    else resolved.set(definition.key, String(value));
  }
  if (problems.missing.length + problems.unknown.length + problems.invalid.length > 0) {
    throw new TemplateVariablesError(problems);
  }
  return resolved;
}

export function filler(resolved: Map<string, string>): Fill {
  return (text) => text.replace(variablePattern(), (whole, key: string) => resolved.get(key) ?? whole);
}
