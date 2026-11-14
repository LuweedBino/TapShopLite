# AGENTS.md

TapShopLite is the standalone version of the TapShop Video Studio (from github.com/LuweedBino/tapshop, `vendor/tapshop-studio/`): the video editor with its two story makers, the **B-roll builder** (`video-broll.js`) and the **Review showcase** (`video-reviews.js`). There's no account, no server and no Media Vault: files come from the device and go back to it.

- It's a static site with no build step. Vercel serves the folder as is, and `index.html` is the editor page (TapShop's `video.html`).
- The code is classic scripts, not modules. Keep the script order at the end of `index.html`: text-catalog → studio-catalog → video → panel-layout → timeline-strips → color-picker → video-start → video-camera → video-gfx → video-gfx-more → video-reviews → video-broll → video-captions → video-autosave → video-export → video-toolbar → video-topbar, then the `tapshop-theme` CSS and JS.
- The Vault, "Sell this" and dashboard messages switch themselves off outside the TapShop iframe (`inTapShop()` in `video.js`). `vault-picker.js` isn't included; anything that uses `VaultPicker` must check `typeof VaultPicker !== 'undefined'` first.
- The start screen's two maker banners sit in `#vsQuick` (built in `video-broll.js`) under a **Quick Video Makers** heading (`.vs-qh`), right below the three-paths intro.
- Auto-save keeps the 12 most recent videos in IndexedDB `tapshop-video-local` (the start screen's Recent videos).
- AI captions and the B-roll builder's clip sorting load transformers.js from jsDelivr and models from Hugging Face in the visitor's browser, so don't add a Content-Security-Policy that blocks those.
- Anything drawn from a `<video>` goes through `paintVideo`, and anything that changes the sound must be added to `mixSound` (`video-export.js`), so preview and export match.
- **Save video** (top bar) opens the export: an MP4 with H.264 picture and AAC sound at 30 fps, short side = the chosen resolution (`exportSize()`, so 1080p vertical is 1080×1920), the format TikTok, Instagram, Facebook and YouTube all accept. The frame-by-frame path (`video-export.js`) only uses `avc` + `aac`; otherwise the real-time recorder runs and, if its file isn't H.264 + AAC MP4 (`socialReady()`), says some apps may refuse it. There's no project save button; auto-save keeps Recent videos.
- Mobile first: check every change at phone width (about 390 px) as well as on a desktop.
- Font and Mediabunny licences live in `licenses/`; keep them when adding fonts or libraries.
- Work on a branch and open a PR into `main`. Commit messages are short, plain English, and describe what the user gets.
