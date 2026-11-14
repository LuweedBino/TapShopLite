// Sign-in settings for TapShopLite (Supabase). Both values are safe to be public: the publishable key only
// identifies the project. enabled: false keeps sign-in off (the video maker is open to everyone) until Google
// or email sending is set up in Supabase; then set it to true.
// providers: the extra sign-in buttons to show; each must also be switched on in Supabase
// (Authentication → Sign In / Providers). Possible: 'google', 'apple', 'facebook', 'azure' (Microsoft), 'github', 'discord'.
window.TAPSHOP_AUTH = {
  enabled: true,
  url: 'https://yxlaoosagblbojazxwix.supabase.co',
  key: 'sb_publishable_aHXFnsZbjrjnPXmj6Kln0w_nluXaPjX',
  providers: [],
};

// Cloud AI for the B-roll Video Maker (Groq, through api/words.js; setup in AI-SETUP.md). cloud: false switches
// it off everywhere and the app uses the on-device AI, as before. The daily limit per person is set on Vercel
// (AI_PER_DAY). Removing it completely: set cloud: false (or delete this block), then delete api/words.js.
window.TAPSHOP_AI = {
  cloud: true,
};
