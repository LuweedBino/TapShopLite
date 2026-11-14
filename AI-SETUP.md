# Cloud AI setup (Groq)

The B-roll Video Maker can use Groq's free cloud AI for more accurate captions and to cut "um"s, pauses, fumbles
and retakes. Until these steps are done, it quietly uses the on-device AI as before.

## 1. Get a free Groq key
1. Go to https://console.groq.com and sign up (no credit card).
2. Click **API Keys** → **Create API Key**. Name it `TapShopLite`. Copy it.
   Keep it secret: never paste it into the code or a chat.

## 2. Get the Supabase secret key (for the daily limit per person)
1. Go to https://supabase.com/dashboard → your TapShopLite project.
2. **Project Settings** → **API Keys** → **Secret keys**. Copy a secret key (starts with `sb_secret_`).
   Without this key there's no daily limit per person.

## 3. Put both keys on Vercel
1. Go to https://vercel.com → **TapShopLite** → **Settings** → **Environment Variables**.
2. Add:
   - `GROQ_API_KEY` = your Groq key
   - `SUPABASE_SECRET_KEY` = your Supabase secret key
   - `AI_PER_DAY` = `10` (optional; cloud AI videos per person per day, default 10)
3. **Deployments** → the newest one → **⋯** → **Redeploy**, so the keys take effect.

## Turning it off or removing it
- **Off for everyone:** in `config.js`, set `cloud: false`. The app goes back to the on-device AI.
- **Off without code:** delete `GROQ_API_KEY` on Vercel and redeploy. The app falls back to the on-device AI.
- **Remove completely:** set `cloud: false`, delete `api/words.js` and this file.
