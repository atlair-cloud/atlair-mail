import mjml2html from "mjml";
import type { TemplateDocument, TemplateTheme, VariableDefinition, VariableValues } from "./document.ts";
import { InvalidTemplateError, TemplateError, TemplateVariablesError } from "./errors.ts";
import { defaultTheme, documentMjml, type RenderContext } from "./mjml.ts";
import { documentText } from "./text.ts";
import { parseDocument, parseTheme } from "./validate.ts";
import { checkDeclared, filler, parseVariables, resolveValues, usedVariables } from "./variables.ts";

export const maxSubjectLength = 998;

const controlCharacters = /[\u0000-\u001f\u007f]/;
const safeLink = /^(https?:\/\/|mailto:)[^\s"'<>]+$/;
const safeImage = /^https?:\/\/[^\s"'<>]+$/;

export interface TemplateInput {
  subject: string;
  content: unknown;
  theme?: unknown;
  variables?: unknown;
}

export interface TemplateSource {
  subject: string;
  content: TemplateDocument;
  theme: TemplateTheme;
  variables: VariableDefinition[];
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

export function validateTemplate(input: TemplateInput): TemplateSource {
  if (input.subject.length > maxSubjectLength || controlCharacters.test(input.subject)) {
    throw new InvalidTemplateError("subject", `must be one line of at most ${maxSubjectLength} characters`);
  }
  const content = parseDocument(input.content);
  const theme = parseTheme(input.theme);
  const variables = parseVariables(input.variables);
  checkDeclared(usedVariables(input.subject, content), variables);
  return { subject: input.subject, content, theme, variables };
}

export type RenderMode = "send" | "preview";

export async function renderTemplate(source: TemplateSource, values: VariableValues = {}, mode: RenderMode = "send"): Promise<RenderedTemplate> {
  const strict = mode === "send";
  const resolved = resolveValues(source.variables, values, strict);
  const fill = filler(resolved);
  const filledByVariable = new Set<string>();
  const checkLink = (url: string, kind: "link" | "image") => {
    if ((kind === "image" ? safeImage : safeLink).test(url)) return url;
    if (!strict && url.includes("{{")) return url;
    filledByVariable.add(url);
    return url;
  };
  const context: RenderContext = { fill, checkLink, theme: { ...defaultTheme, ...source.theme } };

  const subject = fill(source.subject);
  if (subject.length > maxSubjectLength || controlCharacters.test(subject)) {
    throw new TemplateVariablesError({ missing: [], unknown: [], invalid: variablesIn(source.subject) });
  }

  const text = documentText(source.content, context);
  const markup = documentMjml(source.content, context, subject);
  if (filledByVariable.size > 0) {
    throw new TemplateVariablesError({ missing: [], unknown: [], invalid: unsafeLinkVariables(source, resolved, filledByVariable) });
  }

  const { html, errors } = await mjml2html(markup, {
    validationLevel: "strict",
    keepComments: false,
    ignoreIncludes: true,
    fonts: {},
  });
  if (errors.length > 0) {
    throw new TemplateError("ATL_TEMPLATE_RENDER_FAILED", `The template couldn't be rendered: ${errors[0]!.message}`);
  }
  return { subject, html, text };
}

const variablesIn = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([A-Za-z0-9_]{1,50})\s*\}\}/g)].map((match) => match[1]!))];

function unsafeLinkVariables(source: TemplateSource, resolved: Map<string, string>, urls: Set<string>) {
  const suspects = [...resolved.entries()].filter(([, value]) => [...urls].some((url) => url.includes(value))).map(([key]) => key);
  return suspects.length > 0 ? suspects : source.variables.map((definition) => definition.key);
}
