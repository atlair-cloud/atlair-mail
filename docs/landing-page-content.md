# Atlair Mail landing page: content plan

Status: draft, content only (no code yet).
Design source: the home page in `~/atlair` (`app/routes/home.tsx`, `app/components/landing/*`, copy in `app/content.ts`).
Rule carried over from the Atlair site: only claim what ships today. Anything else goes under "Coming soon".

## Voice

Same as atlair.cloud:

- A short serif headline that ends with a period, then one plain sentence, then proof (real UI, not adjectives).
- Each section opens with an italic "beat" line in leaf green.
- Be honest about gaps ("Not available yet. We'll say so here until it is.").
- Use "calm" only in the hero or the closing section.

## Positioning

**One line:** An email API that runs on your own Amazon SES account. Open source, and you can host it yourself.

**Who it's for:** developers who want Resend-style ergonomics but SES pricing and control, plus teams that need non-developers to edit email templates.

**Three pillars:**
1. **Your SES, your data.** You bring your AWS account, your credentials stay encrypted, and you can self-host under AGPL.
2. **You see every step.** Every message goes from queued to delivered with events, signed webhooks and logs.
3. **Safe by default.** Suppression, pre-send checks, idempotency, and it never sends the same email twice.

---

## Section order

Mirrors the home page: Header → Hero → "Frameworks" arch → Story chapters → Included grid → Coming soon → FAQ → Closing → Footer.

### 0. Header

- Nav: How it works (`#story`) · Templates (`#templates`) · Deliverability (`#deliverability`) · Coming soon · FAQ · API docs (link to the existing `/docs`; don't rebuild it).
- CTA: **"Open Atlair Mail"**.

### 1. Hero

- **Eyebrow pill:** `Atlair Mail · Open source · Early preview`
- **H1 (pick one):**
  - **"Email that arrives."** (recommended)
  - "Send it. Know it landed."
  - "Your SES, finally friendly."
- **Dek (~25 words):** "An email API on top of your own Amazon SES account. Send from your code, design templates in the panel, and follow every message from queued to delivered."
- **Primary CTA:** "Start sending" → panel.
  - Note under it: "Bring an AWS account. That's all you need."
- **4 check facts:** Your own SES · Signed webhooks · Never sends twice · AGPL open source
- **Visual:** the `AppWindow` treatment (tilt that settles on scroll) showing the panel **Overview**:
  - 4-step setup guide
  - 7-day summary
  - bounce and complaint rates against the SES limits
  - "Needs attention" list
  - recent emails with status chips

### 2. Arch section (the `frameworks.tsx` analogue) `#how`

- **Beat:** *It starts with an AWS account you already have*
- **H2:** "Your code. Your SES."
- **Dek (~30 words):** "Atlair Mail sits between your app and Amazon SES. Connect your SES account with a least-privilege IAM policy we give you to copy. Keys are encrypted, tied to your organization, and never shown again."
- **Visual:** beams running from cURL / Node.js / Python / "any HTTP client" into the Atlair Mail hub, then out to SES, then to the inbox.
  - Only show languages as "any HTTP client". There is no SDK yet.
- **Closing line:** "No public URL needed. Delivery events can be pulled from a queue in your own AWS account."

### 3. Story chapters `#story`

Use the two-column `Chapter` layout. Alternate sides. Each chapter gets a real UI panel.

**Chapter A: Sending**
- **Beat:** *It starts with one request*
- **H2:** "One request. One email."
- **Body:** "POST the message, get a 202 and an id back. Add an Idempotency-Key and retries can't send it twice. Schedule it up to 30 days out."
- **Visual:** a mono code panel.
  - `POST /service/web/emails` with from, to, subject and a template alias.
  - Below it, the response, then a live status timeline: `queued → sent → delivered` with timestamps (the `deploy-timeline` pattern).

**Chapter B: Templates** `#templates`
- **Beat:** *Someone else wants to change the copy*
- **H2:** "Templates anyone can edit."
- **Body:** "A Notion-style editor: type / for blocks and {{ for variables, and preview it on a phone. Publish with a diff, roll back in one click, and pin a version per send."
- **Visual:** the editor.
  - Slash menu open; a `{{first_name}}` chip with a fallback; the phone preview toggle.
  - A "Publish v4" modal showing the diff.
- **Small print:** "Rendered through MJML to HTML and plain text. Starters: Welcome, Password reset, Receipt."

**Chapter C: Deliverability** `#deliverability`
- **Beat:** *Inboxes decide whether to trust you*
- **H2:** "Set up DNS once. Stay trusted."
- **Body:** "Add a domain and copy the DKIM, SPF and DMARC records. Hard bounces and complaints are suppressed automatically, and your rates are watched against SES's limits."
- **Visual:** domain detail.
  - 3 DKIM CNAMEs, MAIL FROM on `bounce.yourdomain.com`, the recommended DMARC record, with copy buttons and a "Check now" → **Verified** badge.
  - A small inset: bounce rate 0.4% against a 5% limit line.

**Chapter D: Webhooks**
- **Beat:** *You need to know what happened*
- **H2:** "Every event, signed and delivered."
- **Body:** "Sent, delivered, bounced, complained and more, signed to the Standard Webhooks spec. 8 retries over about 27 hours, plus a delivery log for each attempt."
- **Visual:** webhook endpoint page: an event list (AnimatedList), one expanded delivery with headers, and a "Rotate secret" control.
  - Note: "Rotating a secret keeps the old one valid for up to 7 days."

**Chapter E: Reliability** (the "When it breaks" analogue, using the `failure-preview` visual)
- **Beat:** *Sometimes things go wrong*
- **H2:** "It won't send twice."
- **Body:** "Before every send, the worker checks the provider, the domain and the suppression list again. If SES's answer is lost, the email is marked failed instead of being resent, and later events correct its status."
- **Visual:** a worker log in mono showing:
  1. a retry with backoff (attempt 3/6)
  2. a pre-send check blocking a suppressed recipient
  3. a "Next step" hint card

### 4. Included grid (MagicCards, same style as Coming soon but labelled "Included")

- **Beat:** *The rest of the toolbox*
- **H2:** "Built in, not bolted on."
- **6 cards (h3 + one line):**
  1. **Playground**: "Compose, copy as cURL, Node or Python, and send."
  2. **Teams and roles**: "Owner, admin and member, with an audit log."
  3. **Scoped API keys**: "Full access or sending only. Revoke any time."
  4. **Email logs**: "Search every message and its full event history."
  5. **Suppression list**: "Automatic for bounces. Add or remove by hand."
  6. **Self-host it**: "Postgres plus two Node processes. No Redis."

### 5. Coming soon `#coming-soon`

- **Beat:** *What's growing next*
- **H2:** "Coming soon"
- **Dek:** "Not available yet. We'll say so here until it is."
- **5 cards:**
  1. **Attachments**: "Send files alongside your messages."
  2. **Batch sending**: "Many emails in one request."
  3. **Node SDK**: "`mail.emails.send()` in one line."
  4. **Open and click tracking**: "Engagement, turned on per domain."
  5. **Terraform module**: "SES setup as code."
- Contacts and broadcasts are left out on purpose until they're on the roadmap.

### 6. FAQ `#faq` (10 Q&As, sticky left column with "Ask your assistant")

- **Beat:** *Before you send the first one*
- **H2:** "Questions, answered."

1. **What is Atlair Mail?** An email-sending API and panel that runs on your own Amazon SES account.
2. **Why bring my own SES?** You pay AWS's prices directly, keep your sending reputation, and can leave any time.
3. **My SES account is in the sandbox. Can I still use it?** Yes. The panel shows your sandbox state. Request production access from AWS when you're ready to send to anyone.
4. **Are my AWS keys safe?** They're encrypted with rotatable AES-256 keys, tied to your organization, and never returned by the API or written to logs. We give you a least-privilege IAM policy.
5. **Can I self-host it?** Yes. It's AGPL-3.0. You need Postgres, the API and the worker.
6. **Which languages are supported?** Anything that can make an HTTP request. The playground shows cURL, Node.js and Python. An SDK is coming.
7. **How do I verify webhooks?** They follow the Standard Webhooks spec, so existing verification libraries work.
8. **What happens when an email bounces?** Hard bounces and complaints add the address to your suppression list, and later sends to it are blocked.
9. **Do you track opens and clicks?** Not yet. If you enable tracking in SES yourself, those events are passed through to your webhooks.
10. **How much does it cost?** *(Depends on open question 3. Atlair's style answer: "Pricing hasn't been decided yet.")*

### 7. Closing

- **H2:** "Go on. Send the first one."
- **Dek:** "Four steps from AWS keys to a delivered email. The setup guide walks you through each one."
- **CTA:** "Start sending".
  - Note: "Open source, and you can host it yourself."
- **Art:** a new painting, e.g. the mascot carrying an envelope out of the window. Until then, reuse `cta-window`.

### 8. Footer

- Reuse the shared footer.
- Add "Atlair Mail" to the Product column.
- Tagline option: "Email meets cloud, calmly."

---

## SEO and meta

- **Title:** "Atlair Mail: open-source email API on your own Amazon SES"
- **Description:** "Send transactional email through your own SES account. Visual templates, signed webhooks, DKIM/SPF/DMARC setup and automatic suppression. AGPL, self-hostable."
- Add FAQ JSON-LD from the FAQ content, like the home page does.

## Claims to avoid (not built yet)

- attachments, batch sending, SDK, Terraform
- open/click tracking toggles
- contacts, audiences, broadcasts, unsubscribe management
- SSO or password login (panel sign-in is GitHub/Google only)
- test/live keys
- cancelling scheduled sends
- an analytics page
- "one-command Docker deploy" (`compose.prod.yaml` points to a root Dockerfile that doesn't exist)

## Open questions

1. **Hosted or self-host only?** Is there an Atlair-hosted Atlair Mail, or only self-host? This changes the hero CTA ("Start sending" vs "Self-host it" / GitHub) and FAQ 5 and 10.
2. **URL:** `atlair.cloud/mail` (inside the existing site, new `PagePath` in `app/lib/seo.ts`) or `mail.atlair.cloud`?
3. **Pricing:** none, free while in preview, or AWS cost only?
4. **Status label:** "Early preview", "Private preview" or "Open beta"?
5. **Art:** commission new mail paintings or reuse the existing scenes?
6. **Product naming:** "Atlair Mail" (title case, like "Atlair Cloud") or lowercase "atlair-mail"?
