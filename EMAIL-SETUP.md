# Emails from tapshoplite.app (sign-up confirmation, forgot password)

Supabase's built-in email only reaches your own team, so real users need a sender of your own. These steps use
**Resend** (free: 100 emails a day, 3,000 a month) with your domain **tapshoplite.app**. About 15 minutes.

## 1. Resend: send from your domain
1. Sign up free at https://resend.com.
2. **Domains → Add Domain** → type `tapshoplite.app` → **Add**.
3. Resend shows a few **DNS records** (TXT and MX). For each one, in Vercel go to **your team → Domains →
   tapshoplite.app → DNS Records → Add**, and copy the **Type**, **Name** and **Value** from Resend exactly.
   (If Resend offers "Sign in to Vercel" to add them automatically, use that instead.)
4. Back in Resend, click **Verify DNS Records**. It can take a few minutes to turn green ✅.
5. **API Keys → Create API Key**, name it `Supabase`, permission **Sending access**. Copy it (you only see it once).

## 2. Supabase: use Resend for emails
1. Supabase → your project → **Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**.
2. Fill in:
   - Sender email: `hello@tapshoplite.app`
   - Sender name: `TapShopLite`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend API key
3. **Save**. (Supabase checks the settings when you save.)
4. **Authentication → Rate Limits**: "Emails sent per hour" starts at 30. That's fine for now.

## 3. Supabase: the branded emails
**Authentication → Emails → Templates.** For each one, set the **Subject** and paste the whole file from
`email-templates/` into the message body, then **Save**:

| Template | Subject | File |
| --- | --- | --- |
| Confirm sign up | Confirm your TapShopLite email | `confirm-signup.html` |
| Reset password | Reset your TapShopLite password | `reset-password.html` |
| Magic link | Your TapShopLite sign-in link | `magic-link.html` |
| Change email address | Confirm your new TapShopLite email | `change-email.html` |

## 4. Choose: confirm emails or not
**Authentication → Sign In / Providers → Email → Confirm email.**
- **Off** (now): sign-up is instant. "Forgot password" and "Change my password" still send emails.
- **On**: new people get a "Confirm your email" message first, which stops fake sign-ups but adds a step.
  The site handles both: it shows "Check your email" with a **Send it again** button.

## 5. Check the addresses
**Authentication → URL Configuration**: Site URL `https://tapshoplite.app`; Redirect URLs include
`https://tapshoplite.app/**` and `https://www.tapshoplite.app/**` (the reset link goes to `/reset.html`).

## Test
On https://tapshoplite.app: **Sign in → Forgot your password?** with your own email. The email should come from
hello@tapshoplite.app, and its button opens the "Choose a new password" page.
