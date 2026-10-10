# Email templates

A template is a saved email design you send by id or alias, with variables filled in per send. The
design is a TipTap (ProseMirror) JSON document, so the panel's block editor and the API share one
format. The API stores the JSON; `packages/templates` renders it to MJML, then to email-safe HTML
and plain text, at preview and at send time.

The panel's editor is described in [web.md](web.md#template-editor).

## Sending with a template

```json
POST /service/web/emails
{
  "from": "Acme <hello@acme.com>",
  "to": ["ada@example.org"],
  "template": { "id": "welcome", "variables": { "first_name": "Ada", "dashboard_url": "https://acme.com/app" } }
}
```

- `template.id` is the template's id or its alias.
- `subject` is optional and replaces the template's subject. `html` and `text` can't be combined
  with a template (`400 ATL_TEMPLATE_WITH_BODY`).
- The email stores the rendered subject, HTML and text, plus `template: { id, version }`, so later
  edits never change what was sent. Deleting a template clears the link and keeps the content.
- Idempotency keys work as usual: the fingerprint covers the template id and variables.

## Variables

Declare each variable once: `{ key, type: "string" | "number", fallback? }`. Use it as a
`variable` node in text, or as `{{key}}` in the subject, text, button and link addresses, image
addresses and alt text.

| Rule | Limit |
| --- | --- |
| Variables per template | 50 |
| Key | letters, numbers and underscores, up to 50 characters |
| String value or fallback | 2,000 characters |

Saving fails with `422 ATL_TEMPLATE_INVALID` when the subject or content uses an undeclared
variable. Sending fails with `422 ATL_TEMPLATE_VARIABLES` when a variable without a fallback is
missing, a value has the wrong type or is too long, a key isn't declared, a value makes a link
unsafe, or a value breaks the subject onto two lines. Previews leave missing values as `{{key}}`.

Every value is HTML-escaped. A link must be `https://`, `http://` or `mailto:` (images: `http(s)`)
before and after variables are filled in, and a variable can only start a link when it is the whole
link (`{{reset_url}}`), so a value can't turn a link into `javascript:`.

## Blocks

| Block | Attributes |
| --- | --- |
| `paragraph`, `heading` (level 1-3) | `textAlign` |
| `bulletList`, `orderedList` > `listItem` | nested lists allowed |
| `blockquote` | paragraphs |
| `horizontalRule` | |
| `button` | `text`, `href`, `textAlign` |
| `image` | `src`, `alt`, `width` (16-1200), `href`, `textAlign` |
| `spacer` | `height` (4-160) |
| `columns` > `column` (2-3) | flow blocks only |
| `section` | `backgroundColor`, `padding` (0-64); top level only |

Inline: `text` with `bold`, `italic`, `underline`, `strike`, `code` and `link` marks, `hardBreak`,
and `variable { name }`. `theme` sets `brandColor`, `textColor`, `backgroundColor`, `contentColor`,
`fontFamily` (`sans`, `serif`, `mono`) and `width` (480-720). A document can have up to 5,000 nodes,
nested 12 deep. Errors name the exact path, for example `content.content[3].attrs.href`.

Columns stack on phones (MJML's responsive layout). Rendering runs with `mj-include` disabled and
no remote fonts.

## Editing safely

`PATCH /templates/:id` takes the `version` you loaded. Every save adds one; if someone saved in
between, the update fails with `409 ATL_TEMPLATE_CHANGED` and names the current version instead of
overwriting their change. Names and aliases are unique per organization (`409 ATL_TEMPLATE_TAKEN`).

## Endpoints and permissions

| Route | Panel permission | Sending key |
| --- | --- | --- |
| `GET /templates`, `GET /templates/:idOrAlias`, `POST /templates/:idOrAlias/preview` | `template:view` | yes |
| `POST /templates/preview` (unsaved design) | `template:view` | no |
| `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id` | `template:create`, `template:update`, `template:delete` | no |

Every role can view templates; owners and admins manage them. Migration `0019_email_templates`
grants the new permissions to existing roles.
