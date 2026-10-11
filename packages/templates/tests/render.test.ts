import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidTemplateError,
  renderTemplate,
  TemplateVariablesError,
  validateTemplate,
  type TemplateInput,
} from "../src/index.ts";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks && { marks }) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

const welcome: TemplateInput = {
  subject: "Welcome, {{first_name}}",
  content: doc(
    { type: "heading", attrs: { level: 1 }, content: [text("Hi "), { type: "variable", attrs: { name: "first_name" } }] },
    paragraph(text("Thanks for joining "), text("Atlair", [{ type: "bold" }]), text(".")),
    { type: "button", attrs: { text: "Get started", href: "https://atlair.cloud/start?ref={{ref}}" } },
    { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("Send your first email"))] }] },
    { type: "horizontalRule" },
    paragraph(text("Questions? "), text("Reply", [{ type: "link", attrs: { href: "mailto:help@atlair.cloud" } }])),
  ),
  variables: [
    { key: "first_name", type: "string", fallback: "there" },
    { key: "ref", type: "string" },
  ],
};

const fails = (code: string, pattern?: RegExp) => (error: unknown) =>
  error instanceof Error && (error as { code?: string }).code === code && (!pattern || pattern.test(error.message));

describe("validateTemplate", () => {
  it("accepts a template whose variables are declared", () => {
    const source = validateTemplate(welcome);
    assert.equal(source.variables.length, 2);
    assert.equal(source.content.content.length, 6);
  });

  it("names the path of an unknown or misplaced block", () => {
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc(paragraph(text("ok")), { type: "iframe" }) }),
      (error: unknown) => error instanceof InvalidTemplateError && error.path === "content.content[1].type",
    );
    assert.throws(
      () =>
        validateTemplate({
          subject: "Hi",
          content: doc({ type: "section", content: [{ type: "section", content: [] }] }),
        }),
      fails("ATL_TEMPLATE_INVALID", /section isn't allowed inside a section/),
    );
    assert.throws(
      () =>
        validateTemplate({
          subject: "Hi",
          content: doc({ type: "columns", content: [{ type: "column", content: [] }] }),
        }),
      fails("ATL_TEMPLATE_INVALID", /at least 2/),
    );
  });

  it("rejects unsafe links and images", () => {
    for (const href of ["javascript:alert(1)", "{{host}}/reset", "data:text/html,hi", "//evil.example"]) {
      assert.throws(
        () => validateTemplate({ subject: "Hi", content: doc({ type: "button", attrs: { text: "Go", href } }), variables: [{ key: "host", type: "string" }] }),
        fails("ATL_TEMPLATE_INVALID", /href/),
        href,
      );
    }
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc({ type: "image", attrs: { src: "mailto:a@b.c" } }) }),
      fails("ATL_TEMPLATE_INVALID", /src/),
    );
  });

  it("requires every used variable to be declared, once", () => {
    assert.throws(
      () => validateTemplate({ subject: "Order {{order_id}}", content: doc(paragraph(text("Hi {{name}}"))) }),
      fails("ATL_TEMPLATE_INVALID", /declare name, order_id/),
    );
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc(), variables: [{ key: "a", type: "string" }, { key: "a", type: "number" }] }),
      fails("ATL_TEMPLATE_INVALID", /declared twice/),
    );
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc(), variables: [{ key: "total", type: "number", fallback: "ten" }] }),
      fails("ATL_TEMPLATE_INVALID", /fallback/),
    );
  });

  it("fills {{current_year}} without declaring it, and refuses to declare it", async () => {
    const source = validateTemplate({ subject: "© {{current_year}}", content: doc(paragraph(text("© {{ current_year }} Atlair"), { type: "variable", attrs: { name: "current_year" } })) });
    const rendered = await renderTemplate(source, {}, "send", { now: new Date("2031-06-01T00:00:00Z") });
    assert.equal(rendered.subject, "© 2031");
    assert.equal(rendered.text, "© 2031 Atlair2031");
    await assert.rejects(renderTemplate(source, { current_year: "1999" }), TemplateVariablesError);
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc(), variables: [{ key: "current_year", type: "string" }] }),
      fails("ATL_TEMPLATE_INVALID", /built in/),
    );
  });

  it("rejects bad section and button colors", () => {
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc({ type: "section", attrs: { textColor: "white" }, content: [paragraph()] }) }),
      fails("ATL_TEMPLATE_INVALID", /textColor/),
    );
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc({ type: "button", attrs: { text: "Go", href: "https://a.b", variant: "ghost" } }) }),
      fails("ATL_TEMPLATE_INVALID", /variant/),
    );
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc({ type: "button", attrs: { text: "Go", href: "https://a.b", fullWidth: "yes" } }) }),
      fails("ATL_TEMPLATE_INVALID", /fullWidth/),
    );
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc({ type: "button", attrs: { text: "Go", href: "https://a.b", size: "huge" } }) }),
      fails("ATL_TEMPLATE_INVALID", /size/),
    );
  });

  it("rejects unknown social networks and unsafe social links", () => {
    const social = (links: unknown[]) => ({ subject: "Hi", content: doc({ type: "socialLinks", attrs: { links } }) });
    assert.throws(() => validateTemplate(social([{ network: "myspace", href: "https://a.b" }])), fails("ATL_TEMPLATE_INVALID", /network/));
    assert.throws(() => validateTemplate(social([{ network: "x", href: "javascript:alert(1)" }])), fails("ATL_TEMPLATE_INVALID", /links\[0\].href/));
    assert.doesNotThrow(() => validateTemplate(social([])));
  });

  it("rejects a multi-line subject and bad theme values", () => {
    assert.throws(() => validateTemplate({ subject: "Hi\r\nBcc: x@y.z", content: doc() }), fails("ATL_TEMPLATE_INVALID", /subject/));
    assert.throws(
      () => validateTemplate({ subject: "Hi", content: doc(), theme: { brandColor: "red" } }),
      fails("ATL_TEMPLATE_INVALID", /theme.brandColor/),
    );
  });
});

describe("renderTemplate", () => {
  it("renders HTML and plain text with variables filled in", async () => {
    const rendered = await renderTemplate(validateTemplate(welcome), { first_name: "Ada", ref: "launch" });

    assert.equal(rendered.subject, "Welcome, Ada");
    assert.match(rendered.html, /<h1[^>]*>Hi Ada<\/h1>/);
    assert.match(rendered.html, /<strong>Atlair<\/strong>/);
    assert.match(rendered.html, /href="https:\/\/atlair.cloud\/start\?ref=launch"/);
    assert.match(rendered.html, /href="mailto:help@atlair.cloud"/);
    assert.match(rendered.html, /^<!doctype html>/i);
    assert.equal(
      rendered.text,
      [
        "Hi Ada",
        "Thanks for joining Atlair.",
        "Get started: https://atlair.cloud/start?ref=launch",
        "- Send your first email",
        "---",
        "Questions? Reply (mailto:help@atlair.cloud)",
      ].join("\n\n"),
    );
  });

  it("uses fallbacks and escapes every value", async () => {
    const fallback = await renderTemplate(validateTemplate(welcome), { ref: "launch" });
    const hostile = await renderTemplate(validateTemplate(welcome), { first_name: "<script>alert(1)</script>", ref: "launch" });

    assert.equal(fallback.subject, "Welcome, there");
    assert.match(fallback.html, /Hi there/);
    assert.doesNotMatch(hostile.html, /<script>alert/);
    assert.match(hostile.html, /Hi &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  it("refuses a send with missing, unknown or mistyped variables", async () => {
    const source = validateTemplate({
      subject: "Order {{order_id}}",
      content: doc(paragraph(text("Total {{total}}"))),
      variables: [
        { key: "order_id", type: "string" },
        { key: "total", type: "number" },
      ],
    });

    await assert.rejects(
      renderTemplate(source, { total: "12", coupon: "x" }),
      (error: unknown) =>
        error instanceof TemplateVariablesError &&
        error.problems.missing.join() === "order_id" &&
        error.problems.unknown.join() === "coupon" &&
        error.problems.invalid.join() === "total",
    );
  });

  it("keeps placeholders in a preview without values", async () => {
    const rendered = await renderTemplate(validateTemplate(welcome), {}, "preview");

    assert.equal(rendered.subject, "Welcome, there");
    assert.match(rendered.html, /start\?ref=\{\{ref\}\}/);
  });

  it("refuses a variable that turns a link unsafe or breaks the subject", async () => {
    const source = validateTemplate({
      subject: "Reset for {{name}}",
      content: doc({ type: "button", attrs: { text: "Reset", href: "{{reset_url}}" } }),
      variables: [
        { key: "reset_url", type: "string" },
        { key: "name", type: "string", fallback: "you" },
      ],
    });

    await assert.rejects(renderTemplate(source, { reset_url: "javascript:alert(1)" }), fails("ATL_TEMPLATE_VARIABLES", /reset_url/));
    await assert.rejects(renderTemplate(source, { reset_url: "https://a.example", name: "x\r\nBcc: y" }), fails("ATL_TEMPLATE_VARIABLES", /name/));
    const ok = await renderTemplate(source, { reset_url: "https://atlair.cloud/reset/abc" });
    assert.match(ok.html, /href="https:\/\/atlair.cloud\/reset\/abc"/);
  });

  it("lays out columns, sections, images and the theme", async () => {
    const rendered = await renderTemplate(
      validateTemplate({
        subject: "Layout",
        content: doc(
          {
            type: "section",
            attrs: { backgroundColor: "#eef2ff", padding: 24 },
            content: [
              {
                type: "columns",
                content: [
                  { type: "column", content: [paragraph(text("Left"))] },
                  { type: "column", content: [{ type: "image", attrs: { src: "https://atlair.cloud/logo.png", alt: "Atlair", width: 120 } }] },
                ],
              },
            ],
          },
          { type: "spacer", attrs: { height: 24 } },
          paragraph(),
        ),
        theme: { brandColor: "#4f46e5", backgroundColor: "#fafafa", width: 640 },
      }),
    );

    assert.match(rendered.html, /#eef2ff/i);
    assert.match(rendered.html, /#fafafa/i);
    assert.match(rendered.html, /src="https:\/\/atlair.cloud\/logo.png"/);
    assert.match(rendered.html, /max-width:640px/);
    assert.equal(rendered.text, "Left\n\n[Atlair]");
  });

  it("picks readable text and link colors inside a dark section", async () => {
    const link = text("Read more", [{ type: "link", attrs: { href: "https://atlair.cloud" } }]);
    const rendered = await renderTemplate(
      validateTemplate({
        subject: "Dark",
        content: doc(
          { type: "section", attrs: { backgroundColor: "#111827" }, content: [{ type: "heading", attrs: { level: 2 }, content: [text("Night")] }, paragraph(link)] },
          paragraph(text("Outside")),
        ),
        theme: { brandColor: "#243041" },
      }),
    );

    assert.match(rendered.html, /<h2 style="[^"]*color:#ffffff">Night/);
    assert.match(rendered.html, /<a href="https:\/\/atlair.cloud" style="color:#ffffff;/);
    assert.match(rendered.html, /color:#1f2937[^>]*>[^]*?Outside/);
  });

  it("uses a section's own text color, and keeps the brand color for links when it reads well", async () => {
    const link = text("Docs", [{ type: "link", attrs: { href: "https://atlair.cloud/docs" } }]);
    const rendered = await renderTemplate(
      validateTemplate({
        subject: "Custom",
        content: doc({ type: "section", attrs: { backgroundColor: "#fff7ed", textColor: "#7c2d12" }, content: [{ type: "blockquote", content: [paragraph(text("Quoted"))] }, paragraph(link)] }),
        theme: { brandColor: "#2563eb" },
      }),
    );

    assert.match(rendered.html, /<blockquote style="[^"]*color:#7c2d12">/);
    assert.match(rendered.html, /<a href="https:\/\/atlair.cloud\/docs" style="color:#2563eb;/);
  });

  it("renders social icons from the API's assets, light on dark sections, and text links without them", async () => {
    const social = { type: "socialLinks", attrs: { links: [{ network: "github", href: "https://github.com/atlair" }, { network: "email", href: "mailto:hi@atlair.cloud" }] } };
    const source = validateTemplate({
      subject: "Social",
      content: doc(social, { type: "section", attrs: { backgroundColor: "#111827" }, content: [social] }),
    });

    const withIcons = await renderTemplate(source, {}, "send", { assetsUrl: "https://mail.example.com/assets/" });
    assert.match(withIcons.html, /src="https:\/\/mail.example.com\/assets\/social\/github-dark.png"/);
    assert.match(withIcons.html, /src="https:\/\/mail.example.com\/assets\/social\/github-light.png"/);
    assert.match(withIcons.html, /href="mailto:hi@atlair.cloud"/);
    assert.equal(withIcons.text, "GitHub: https://github.com/atlair\nEmail: mailto:hi@atlair.cloud\n\nGitHub: https://github.com/atlair\nEmail: mailto:hi@atlair.cloud");

    const withoutIcons = await renderTemplate(source);
    assert.doesNotMatch(withoutIcons.html, /<img[^>]*social/);
    assert.match(withoutIcons.html, /<a href="https:\/\/github.com\/atlair"[^>]*>GitHub<\/a> &middot; <a href="mailto:hi@atlair.cloud"/);
  });

  it("colors buttons, with readable text on a light brand color and an outline style", async () => {
    const button = (attrs: object) => ({ type: "button", attrs: { text: "Go", href: "https://atlair.cloud", ...attrs } });
    const rendered = await renderTemplate(
      validateTemplate({
        subject: "Buttons",
        content: doc(button({}), button({ color: "#16a34a", variant: "outline", fullWidth: true }), button({ size: "large" })),
        theme: { brandColor: "#fde68a" },
      }),
    );

    assert.match(rendered.html, /background:#fde68a[^>]*>[^]*?color:#111827/);
    assert.match(rendered.html, /border:2px solid #16a34a/);
    assert.match(rendered.html, /color:#16a34a/);
    assert.match(rendered.html, /width:100%[^>]*>[^]*?border:2px solid #16a34a/);
    assert.match(rendered.html, /font-size:17px[^"]*padding:16px 28px|padding:16px 28px[^"]*font-size:17px/);
  });
});
