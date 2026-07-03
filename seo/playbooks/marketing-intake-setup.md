# IVAE Marketing — Intake Form Setup Guide

The intake form lives at **https://ivaestudios.com/marketing-intake**.

The form posts to `/api/marketing-intake` (a Cloudflare Pages Function) which
emails the brief to `info@ivaestudios.com` via Resend.

## What is already deployed

- ✅ `/marketing-intake.html` — the 8-step form page (live)
- ✅ `/functions/api/marketing-intake.js` — backend handler (live)
- ✅ Aliases: `/intake`, `/ivae-marketing/intake`, `/strategy-brief` all redirect to it

## What still needs to be configured (one-time, ~30 min)

### Step 1 — Resend account (5 min)

1. Go to https://resend.com/signup
2. Sign up with `info@ivaestudios.com`
3. **Verify the domain `ivaestudios.com`:**
   - Resend → Domains → Add Domain → `ivaestudios.com`
   - Resend will give you 3 DNS records (SPF + DKIM + DMARC TXT)
   - Add those records in Cloudflare → DNS → Records
   - Wait 5 min, Resend will confirm verification
4. Create an API key:
   - Resend → API Keys → Create
   - Name: "IVAE Marketing Intake"
   - Permission: **Sending access only**
   - Copy the key (`re_...`) — you will paste it in Step 3

**Cost:** Free tier = 3,000 emails/month. Should be plenty.

### Step 2 — Cloudflare Turnstile (3 min)

1. Cloudflare dashboard → Turnstile
2. Add site → Domain: `ivaestudios.com`
3. Copy the **Site Key** (public, starts with `0x4AAA...`) — paste into the form
4. Copy the **Secret Key** (private) — paste in Step 3

### Step 3 — Cloudflare Pages secrets (5 min)

Cloudflare dashboard → Workers & Pages → ivaestudios → Settings → Environment variables → Production

Add 4 variables:

| Variable | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | Secret (encrypted) | `re_...` from Step 1 |
| `TURNSTILE_SECRET_KEY` | Secret (encrypted) | from Step 2 |
| `INTAKE_TO_EMAIL` | Plaintext | `info@ivaestudios.com` |
| `INTAKE_FROM_EMAIL` | Plaintext | `info@ivaestudios.com` |

Click "Save and deploy". Pages will redeploy with the secrets injected.

### Step 4 — Update the form with Turnstile site key (2 min)

1. Open `/marketing-intake.html`
2. Find this line:
   ```html
   <div class="cf-turnstile" data-sitekey="0x4AAAAAAA_PLACEHOLDER_REPLACE_IN_DASHBOARD" data-theme="light"></div>
   ```
3. Replace `0x4AAAAAAA_PLACEHOLDER_REPLACE_IN_DASHBOARD` with your real Site Key
4. Commit and push

### Step 5 — Test the form (5 min)

1. Open https://ivaestudios.com/marketing-intake in incognito
2. Fill out all 8 steps
3. Submit
4. Check `info@ivaestudios.com` — the brief should arrive in ~30 seconds
5. Verify the email is formatted properly (one client per row, all sections visible)

If the email does NOT arrive:
- Check Resend dashboard → Logs (any errors?)
- Check Cloudflare Pages → Deployments → Logs (any function errors?)
- Verify all 4 environment variables are spelled correctly

## How to share the form with a prospect

The cleanest URL to share: **https://ivaestudios.com/marketing-intake**

For Smile Now Dental Clinic specifically, the WhatsApp message could be:

> Hi Dr. Peñuela, this is Vianey from IVAE Studios in Cancún.
>
> We have followed Smile Now's work for some time and built a marketing strategy specifically for luxury hospitality and medical brands in México.
>
> Before we propose anything, we put together a brief that helps us understand exactly what would move Smile Now forward in the next 12 months. It takes about 18 minutes:
>
> https://ivaestudios.com/marketing-intake
>
> Once you complete it we will send you a custom Social Strategy Snapshot within 7 days — no charge, no commitment.

## How leads will arrive

When Smile Now (or any prospect) submits the form, you will receive an email at `info@ivaestudios.com` that looks like:

```
From: IVAE Marketing Intake <info@ivaestudios.com>
Reply-To: dra.penuela@smilenowdental.com   ← so replying goes straight to them
Subject: IVAE Marketing — Strategy Brief from Smile Now Dental Clinic

[Branded HTML email with 8 sections, all answers formatted in tables,
 timestamp, IP, referrer, user-agent footer for context]
```

You can reply directly to the email — your reply goes to the prospect's email,
not back to the intake address.

## Rate limiting

The function rate-limits to **3 submissions per IP per 60 seconds**. This
prevents form abuse. A legitimate prospect filling out once will never hit this.

## Anti-spam

- Honeypot field (hidden `website` input) catches naive bots
- Cloudflare Turnstile catches sophisticated bots
- HTML escaping prevents injection attacks via the email body
- Field length caps prevent log-bombing

## When to roll out

This is fully production-ready. Once Steps 1-4 are done, send the link to one
test prospect (or yourself) to confirm. Then start sharing.

## Files involved (for reference)

- Form page: `/marketing-intake.html`
- Backend: `/functions/api/marketing-intake.js`
- Redirects: `/_redirects` (intake aliases)
- This guide: `/seo/playbooks/marketing-intake-setup.md`
