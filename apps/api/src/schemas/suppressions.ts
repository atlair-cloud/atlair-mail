import { Type } from "typebox";
import { suppressionReasons } from "@atlair-mail/db";
import { Uuid } from "../lib/schemas.ts";
import { CreatedBySchema } from "./authors.ts";
import { maxSuppressionPageSize } from "../services/suppressions.ts";

const Address = Type.String({
  minLength: 3,
  maxLength: 320,
  pattern: "^[^\\u0000-\\u001f\\u007f]*$",
  examples: ["ada@example.com"],
});

export const SuppressionSchema = Type.Object({
  id: Uuid(),
  address: Type.String(),
  reason: Type.Enum(suppressionReasons, {
    description: "hard_bounce and complaint are added automatically from provider events; manual by you.",
  }),
  sourceEmailId: Type.Union([Uuid(), Type.Null()], {
    description: "The email whose bounce or complaint caused this entry.",
  }),
  ...CreatedBySchema,
});

export const SuppressionListQuerySchema = Type.Object({
  address: Type.Optional(Address),
  after: Type.Optional(
    Type.String({ format: "uuid", description: "Return entries after this id, the last id of the previous page." }),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: maxSuppressionPageSize, default: 50 })),
});

export const SuppressionListSchema = Type.Object({
  data: Type.Array(SuppressionSchema),
  hasMore: Type.Boolean(),
});

export const AddSuppressionSchema = Type.Object({ address: Address }, { additionalProperties: false });
