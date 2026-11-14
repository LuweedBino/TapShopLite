# TapShopLite

Turn your clips and product reviews into short videos for TikTok, Reels and Shorts, right in your browser. Works on phones, tablets, laptops and desktops (iPhone, Android, Mac, PC).

- **B-roll builder**: add your clips, pick a story (Hook → Problem → Solution → CTA and 9 more), and it builds the video with words on screen and a free beat.
- **Review showcase**: paste screenshots of reviews and they're animated for you.
- **Full video editor**: captions, graphics, text, stickers, music, then export as MP4.

Nothing is uploaded: files stay on the device, and the finished video downloads to it.

## Accounts

The home page (`index.html`) has sign-up by email link or Google through Supabase, required before opening the video maker (`studio.html`). It's off until `config.js` is filled in; see `SIGN-IN-SETUP.md`.

## Hosting

A plain static site with no build step and no server. On Vercel: **Add New → Project**, pick this repository, then **Deploy**.

Run it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

Licences for the fonts and Mediabunny are in `licenses/`.
