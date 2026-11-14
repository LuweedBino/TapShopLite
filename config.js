// Sign-in settings for TapShopLite (Supabase). Both values are safe to be public: the publishable key only
// identifies the project. Leave url empty to turn sign-in off (the video maker is then open to everyone).
// providers: the extra sign-in buttons to show; each must also be switched on in Supabase
// (Authentication → Sign In / Providers). Possible: 'google', 'apple', 'facebook', 'azure' (Microsoft), 'github', 'discord'.
window.TAPSHOP_AUTH = {
  url: '',
  key: '',
  providers: ['google'],
};
