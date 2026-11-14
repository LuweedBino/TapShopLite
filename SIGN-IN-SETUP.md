# Turning on sign-in (Supabase)

Sign-up is **email + password**, like TapShop: Supabase stores the accounts for free and no emails are sent, so no domain or email service is needed.

1. Supabase project: done (URL and publishable key are in `config.js`).
2. In Supabase: **Authentication → Sign In / Providers → Email**: keep **Email** on, turn **Confirm email** **off**, and **Save**.
3. **Authentication → URL Configuration**: Site URL `https://tapshoplite.vercel.app`, Redirect URL `https://tapshoplite.vercel.app/**`.
4. In `config.js` set `enabled: true`.

Later, with a domain of your own and an email service (like Resend), you can turn on email checks and "forgot password" emails.

---

# Turning on sign-in (Supabase)

Until `config.js` has a Supabase URL and key, the video maker is open to everyone and the home page says accounts are opening soon. After that, people sign up on the home page (email link or Google) before they can open `studio.html`.

## 1. Create the Supabase project (5 min)
1. Go to supabase.com, sign up free, and create a new project (any name, e.g. TapShopLite; pick a region near you).
2. Open **Project Settings → API keys**. Copy the **Project URL** and the **publishable key** (starts with `sb_publishable_`). Never use the secret key.
3. Open **Authentication → URL Configuration**:
   - Site URL: `https://tapshoplite.vercel.app`
   - Redirect URLs: add `https://tapshoplite.vercel.app/**`

## 2. Email sign-in links (10 min, needed for real users)
Supabase's built-in email only reaches your own team and only sends a couple of emails an hour, so connect a free email sender:
1. Sign up at resend.com (free plan) and create an API key.
2. In Supabase: **Authentication → Emails → SMTP Settings**, turn on custom SMTP and enter Resend's settings (host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, a sender address on a domain verified in Resend).
3. In **Authentication → Rate Limits**, raise "emails sent per hour" if you expect a lot of sign-ups.

## 3. Google sign-in (optional, not used for now)
1. In Supabase: **Authentication → Sign In / Providers → Google**. Copy the **Callback URL** shown there.
2. In Google Cloud Console (console.cloud.google.com): create a project, set up the **OAuth consent screen** (app name TapShopLite, your email), then **Credentials → Create credentials → OAuth client ID → Web application**. Paste the Supabase Callback URL under **Authorized redirect URIs**.
3. Copy the Google **Client ID** and **Client secret** into the Supabase Google provider and switch it on.

## 4. Put the two values in `config.js`
```js
window.TAPSHOP_AUTH = {
  url: 'https://YOUR-PROJECT.supabase.co',
  key: 'sb_publishable_...',
  providers: [],
};
```
More buttons (Apple, Facebook, Microsoft `azure`, GitHub, Discord) appear when you add them to `providers`, after switching them on in Supabase.
