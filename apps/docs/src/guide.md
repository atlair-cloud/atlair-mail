Send product email from your own Amazon SES account with one HTTP request. Every request below can be tried from this page: add your API key under **Authentication**, then press **Test Request**.

# Quickstart

1. Set up Amazon SES in your AWS account: pick a region, verify your email address and domain, and create an IAM user with an access key. **Set up Amazon SES** below walks through each step.
2. Sign in to the panel at [mail.atlair.cloud](https://mail.atlair.cloud) and create an organization.
3. Connect SES with the access key and add your domain.
4. Create an API key on the **API keys** tab. The token is shown once, so copy it then.
5. Send an email:

```bash
curl -X POST https://api.atlair.cloud/mail/service/web/emails \
  -H "Authorization: Bearer $ATLAIR_MAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <hello@example.com>",
    "to": ["you@example.com"],
    "subject": "It works",
    "text": "Sent with Atlair Mail."
  }'
```

The email is queued and the response comes back right away with its `id`. Follow it with `GET /service/web/emails/{id}/events`.

## Authentication

Every request sends an API key as a Bearer token. The key belongs to one organization, so requests never include an organization ID.

| Permission | Can do |
| --- | --- |
| `full_access` | Everything below |
| `sending_access` | Send emails and read them |

## Versions

Send `api-version: 1` to pin a version. Without it you get the current version, which today is `1`.

## Safe retries

Send an `Idempotency-Key` header with each email. If a request times out, send it again with the same key: the email is sent once, and the replayed response carries `idempotent-replayed: true`.

# Set up Amazon SES

Atlair Mail sends through your own SES account, so your sending reputation and your AWS bill stay yours. Do the steps in order: everything in AWS first, then connect it to Atlair Mail. It takes about fifteen minutes, plus up to a day for AWS to approve production access.

## 1. Pick one SES region

SES is separate in every AWS region. Verified identities, sandbox status and sending limits in one region don't carry over to another, so pick one region and use it for every step.

Choose the region closest to your users, for example `us-east-1` (N. Virginia), `eu-west-1` (Ireland) or `ap-south-1` (Mumbai). Switch to it with the region selector at the top right of the AWS console before you open SES, and note its **code**, such as `ap-south-1`. You enter that exact code when you connect.

New SES accounts start on the **Essentials** plan, at $0.16 per 1,000 emails. Atlair Mail needs only plain sending, so you can switch to **à la carte** pricing, at $0.10 per 1,000 emails with no monthly fee. See [SES pricing](https://aws.amazon.com/ses/pricing/) for the current rates.

## 2. Verify your email address and domain

In the SES console, open **Configuration → Identities → Create identity** and create two identities:

| Identity | How | Why |
| --- | --- | --- |
| **Email address**, for example `you@example.com` | AWS emails a link to the address. Open it. | While your account is in the sandbox, you can only send to verified addresses, so this is your test inbox. |
| **Domain**, for example `example.com` | Keep **Easy DKIM** with **RSA 2048-bit**. SES shows three CNAME records: publish them at your DNS provider. | Only verified domains can send. The DKIM records prove the mail is yours. |

The domain shows **Verified** once AWS finds the records, usually within minutes and at most 72 hours. Atlair Mail uses this same identity when you add the domain in step 7, so you publish the DKIM records only once.

## 3. Request production access

New SES accounts start in the sandbox: they can only send to verified addresses, up to 200 emails a day. Ask AWS to lift that now, since approval can take up to a day.

In the SES console, open **Account dashboard → Request production access** and fill in:

| Field | What to write |
| --- | --- |
| Mail type | **Transactional** for password resets, receipts and other product email |
| Website URL | Your product's website |
| Use case description | What you send and to whom, that recipients asked for it, and that bounces and complaints are suppressed automatically |

Until AWS approves, test with your verified address or the SES mailbox simulator. The simulator works in the sandbox and doesn't count against your reputation:

| Address | Simulates |
| --- | --- |
| `success@simulator.amazonses.com` | Delivery |
| `bounce@simulator.amazonses.com` | A hard bounce |
| `complaint@simulator.amazonses.com` | A spam complaint |

## 4. Create the IAM policy

The policy lets Atlair Mail send, read your identities, and set up delivery events, and nothing else.

In the IAM console, open **Policies → Create policy**, switch to the **JSON** tab, and paste:

```json
{{ses-iam-policy}}
```

Name it `AtlairMailSending` and create it.

## 5. Create an IAM user and access key

Atlair Mail connects with an access key, and access keys belong to IAM users, so create a user rather than a role. Give it nothing but this policy, so you can rotate or delete its key without affecting anything else.

1. In IAM, open **Users → Create user**. Name it `atlair-mail` and leave console access off.
2. Under **Set permissions**, choose **Attach policies directly**, select `AtlairMailSending`, and create the user.
3. Open the user, go to **Security credentials → Create access key**, and choose **Application running outside AWS**.
4. Copy both values. AWS shows the secret only once.

| Value | Looks like |
| --- | --- |
| Access key ID | `AKIA` followed by 16 letters and digits |
| Secret access key | 40 characters |

## 6. Connect SES to Atlair Mail

In the panel, open **Settings → Provider** and choose your region, or call the API:

```bash
curl -X PUT https://api.atlair.cloud/mail/service/web/provider \
  -H "Authorization: Bearer $ATLAIR_MAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ses",
    "region": "ap-south-1",
    "accessKeyId": "AKIA...",
    "secretAccessKey": "..."
  }'
```

| Field | Value |
| --- | --- |
| `region` | The exact region code from step 1, such as `ap-south-1`, not its name. It must be the region where you verified your identities. |
| `accessKeyId` | From step 5 |
| `secretAccessKey` | From step 5. Stored encrypted and never returned. |

Atlair Mail checks the key with AWS before saving it. The response shows `sandbox`, `sendingEnabled` and `dailyQuota` for that region, so you can see whether production access has been granted.

## 7. Add your domain

```bash
curl -X POST https://api.atlair.cloud/mail/service/web/domains \
  -H "Authorization: Bearer $ATLAIR_MAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "example.com"}'
```

Because you verified the domain in step 2, Atlair Mail finds the existing SES identity and its DKIM records. The response also lists two more records worth publishing:

| Record | Why |
| --- | --- |
| `MAIL FROM` MX and SPF TXT on `bounce.<domain>` | They align SPF with your domain. |
| `_dmarc.<domain>` TXT `v=DMARC1; p=none;` | Gmail and Yahoo expect it from bulk senders. |

Check the status any time with `POST /service/web/domains/{id}/verify`.

## 8. Turn on delivery events

Delivered, bounced and complained events tell you what happened to each email, and they stop you from sending to addresses that bounce.

```bash
curl -X POST https://api.atlair.cloud/mail/service/web/provider/events \
  -H "Authorization: Bearer $ATLAIR_MAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "pull"}'
```

This creates a queue in your AWS account that Atlair Mail reads. Events wait there for up to 14 days, so none are lost.

## 9. Send a test email

Send from an address at your domain to the address you verified in step 2, or to `success@simulator.amazonses.com`, using the request in **Quickstart**. Once AWS grants production access, you can send to anyone.

## If something fails

| Error | Usual cause |
| --- | --- |
| `ATL_PROVIDER_REJECTED: MessageRejected` | The account is still in the sandbox and the recipient isn't verified. |
| `AccessDenied` | The policy from step 4 isn't attached to the user, or a statement is missing. |
| The domain stays unverified | The DKIM records aren't published yet, or the domain was verified in a different region. |
