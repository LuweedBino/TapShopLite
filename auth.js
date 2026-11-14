// Sign-in for TapShopLite, through Supabase (settings in config.js). No passwords: email gets a one-tap
// sign-in link, or people continue with Google and the other providers listed in config.js.
// window.TapAuth: on (sign-in is set up), session() → the current session or null, email(address),
// provider(name), signOut(), onChange(fn).
(()=>{
const cfg=window.TAPSHOP_AUTH||{},on=!!(cfg.url&&cfg.key);
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
let client=null;
function load(){if(client)return client;client=new Promise((res,rej)=>{if(window.supabase?.createClient)return res();
    const s=document.createElement('script');s.src=LIB;s.onload=res;s.onerror=()=>rej(Error('The sign-in service could not load. Check your internet connection and try again.'));document.head.appendChild(s)})
  // implicit flow: the email link works even when it opens in a different browser (like a phone's mail app).
  .then(()=>window.supabase.createClient(cfg.url,cfg.key,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));return client}
const studio=()=>new URL('studio.html',location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,'')).href;
window.TapAuth={on,providers:Array.isArray(cfg.providers)?cfg.providers:[],
  async session(){if(!on)return null;const c=await load();const {data}=await c.auth.getSession();return data.session||null},
  async email(address){const c=await load();const {error}=await c.auth.signInWithOtp({email:address,options:{emailRedirectTo:studio(),shouldCreateUser:true}});if(error)throw error},
  async provider(name){const c=await load();const {error}=await c.auth.signInWithOAuth({provider:name,options:{redirectTo:studio()}});if(error)throw error},
  async signOut(){if(!on)return;const c=await load();await c.auth.signOut()},
  async onChange(fn){if(!on)return;const c=await load();c.auth.onAuthStateChange((_e,s)=>fn(s))}};
})();
