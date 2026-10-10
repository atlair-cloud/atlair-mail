import { Type } from "typebox";
import { DateTime, Uuid } from "../lib/schemas.ts";

const ActorSchema = Type.Union(
  [
    Type.Object({ type: Type.Literal("user"), id: Uuid(), name: Type.String() }, { title: "Member" }),
    Type.Object({ type: Type.Literal("api_key"), id: Uuid(), name: Type.String() }, { title: "API key" }),
  ],
  { description: "A member acting in the panel, or an API key." },
);

const actor = (description: string) => Type.Union([ActorSchema, Type.Null()], { description });

export const CreatedBySchema = {
  createdAt: DateTime(),
  createdBy: actor("Who created it. Null when Atlair Mail created it, or the member or key no longer exists."),
};

export const AuthorshipSchema = {
  ...CreatedBySchema,
  updatedAt: Type.Unsafe<Date>(
    Type.String({
      format: "date-time",
      description: "When it was last changed through the API or the panel. Background work leaves it alone.",
    }),
  ),
  updatedBy: actor("Who last changed it. Null when Atlair Mail made the change, or the member or key no longer exists."),
};
