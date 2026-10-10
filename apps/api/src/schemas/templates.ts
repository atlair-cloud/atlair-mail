import { Type } from "typebox";
import { templateAliasPattern } from "@atlair-mail/db";
import {
  fontFamilies,
  maxSubjectLength,
  maxVariables,
  maxVariableValueLength,
  variableTypes,
  type TemplateDocument,
} from "@atlair-mail/templates";
import { Uuid } from "../lib/schemas.ts";
import { AuthorshipSchema } from "./authors.ts";

export const maxTemplatePageSize = 100;

const HexColor = Type.String({ pattern: "^#[0-9a-fA-F]{6}$", examples: ["#4f46e5"] });

export const TemplateIdOrAlias = Type.String({
  minLength: 1,
  maxLength: 63,
  description: "The template's id, or its alias.",
  examples: ["welcome"],
});

const Name = Type.String({ minLength: 1, maxLength: 100, examples: ["Welcome"] });

const Alias = Type.String({
  pattern: templateAliasPattern,
  description: "A stable, readable name to send with instead of the id: lowercase letters, numbers and dashes.",
  examples: ["welcome"],
});

const Subject = Type.String({
  minLength: 1,
  maxLength: maxSubjectLength,
  description: "Can use {{variables}}.",
  examples: ["Welcome to Acme, {{first_name}}"],
});

const Node = Type.Record(Type.String(), Type.Unknown());

const Content = Type.Unsafe<TemplateDocument>(Type.Object(
  { type: Type.Literal("doc"), content: Type.Array(Node) },
  {
    additionalProperties: true,
    description:
      "The design, as a TipTap (ProseMirror) document. Blocks: paragraph, heading (level 1-3), bulletList, orderedList, blockquote, horizontalRule, button { text, href }, image { src, alt, width, href }, spacer { height }, columns (2-3 column), section { backgroundColor, padding }. Inline: text with bold, italic, underline, strike, code and link marks; hardBreak; variable { name }. Text and links can also use {{variables}}.",
    examples: [
      {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Hi {{first_name}}" }] },
          { type: "button", attrs: { text: "Get started", href: "https://example.com/start" } },
        ],
      },
    ],
  },
));

const Theme = Type.Object(
  {
    brandColor: Type.Optional(HexColor),
    textColor: Type.Optional(HexColor),
    backgroundColor: Type.Optional(HexColor),
    contentColor: Type.Optional(HexColor),
    fontFamily: Type.Optional(Type.Enum(fontFamilies)),
    width: Type.Optional(Type.Integer({ minimum: 480, maximum: 720 })),
  },
  { additionalProperties: false, description: "Colors, font and width for the whole email." },
);

const Variable = Type.Object(
  {
    key: Type.String({ pattern: "^[A-Za-z0-9_]{1,50}$", examples: ["first_name"] }),
    type: Type.Enum(variableTypes),
    fallback: Type.Optional(
      Type.Unsafe<string | number>({
        description: `A string up to ${maxVariableValueLength} characters or a number, matching type. Used when a send leaves it out. Without one, the variable is required.`,
        examples: ["there", 30],
      }),
    ),
  },
  { additionalProperties: false },
);

const Variables = Type.Array(Variable, { maxItems: maxVariables });

export const VariableValuesSchema = Type.Record(
  Type.String(),
  Type.Unsafe<string | number>({ description: `A string up to ${maxVariableValueLength} characters, or a number for number variables.` }),
  { maxProperties: maxVariables, description: "Values for the template's variables.", examples: [{ first_name: "Ada", expires_in_minutes: 30 }] },
);

export const TemplateSummarySchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  alias: Type.Union([Type.String(), Type.Null()]),
  subject: Type.String(),
  variables: Variables,
  version: Type.Integer({ description: "Goes up by one on every change." }),
  ...AuthorshipSchema,
});

export const TemplateSchema = Type.Object({
  ...TemplateSummarySchema.properties,
  content: Content,
  theme: Theme,
});

export const CreateTemplateSchema = Type.Object(
  {
    name: Name,
    alias: Type.Optional(Alias),
    subject: Subject,
    content: Content,
    theme: Type.Optional(Theme),
    variables: Type.Optional(Variables),
  },
  { additionalProperties: false },
);

export const UpdateTemplateSchema = Type.Object(
  {
    version: Type.Integer({
      minimum: 1,
      description: "The version you started from. If someone saved since, the update fails with 409 instead of overwriting their change.",
    }),
    name: Type.Optional(Name),
    alias: Type.Optional(Type.Union([Alias, Type.Null()])),
    subject: Type.Optional(Subject),
    content: Type.Optional(Content),
    theme: Type.Optional(Theme),
    variables: Type.Optional(Variables),
  },
  { additionalProperties: false, minProperties: 2 },
);

export const TemplateListQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: "Match the name or alias, ignoring case." })),
  before: Type.Optional(Type.String({ format: "uuid", description: "Return templates older than this id, the last id of the previous page." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: maxTemplatePageSize, default: 50 })),
});

export const TemplateListSchema = Type.Object({ data: Type.Array(TemplateSummarySchema), hasMore: Type.Boolean() });

export const PreviewTemplateSchema = Type.Object(
  { variables: Type.Optional(VariableValuesSchema) },
  { additionalProperties: false },
);

export const PreviewDraftSchema = Type.Object(
  {
    subject: Subject,
    content: Content,
    theme: Type.Optional(Theme),
    variables: Type.Optional(Variables),
    values: Type.Optional(VariableValuesSchema),
  },
  { additionalProperties: false },
);

export const RenderedTemplateSchema = Type.Object({
  subject: Type.String(),
  html: Type.String(),
  text: Type.String(),
});

export const EmailTemplateSchema = Type.Object(
  { id: TemplateIdOrAlias, variables: Type.Optional(VariableValuesSchema) },
  { additionalProperties: false, description: "Send a saved template instead of html and text. subject overrides the template's subject." },
);
