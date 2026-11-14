// Sign-in for TapShopLite, through Supabase (settings in config.js): email + password, like TapShop, so no
// emails need sending (Supabase's "Confirm email" is off). Providers in config.js add extra buttons.
// window.TapAuth: on (sign-in is set up), session() → the current session or null, signUp(email, password)
// (→ the session, or null when Supabase's "Confirm email" is on and a confirmation email was sent),
// signIn(email, password), resend(email) (the confirmation email again), resetPassword(email) (emails a link to
// reset.html), updatePassword(password) (for a signed-in or just-reset user), email(address) (magic link, unused),
// provider(name), signOut(), onChange(fn). Emails need custom SMTP in Supabase (EMAIL-SETUP.md).
(()=>{
const cfg=window.TAPSHOP_AUTH||{},on=!!(cfg.url&&cfg.key&&cfg.enabled!==false);
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
let client=null;
function load(){if(client)return client;client=new Promise((res,rej)=>{if(window.supabase?.createClient)return res();
    const s=document.createElement('script');s.src=LIB;s.onload=res;s.onerror=()=>rej(Error('The sign-in service could not load. Check your internet connection and try again.'));document.head.appendChild(s)})
  // implicit flow: the email link works even when it opens in a different browser (like a phone's mail app).
  .then(()=>window.supabase.createClient(cfg.url,cfg.key,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));return client}
const page=name=>new URL(name,location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,'')).href,studio=()=>page('studio.html');
window.TapAuth={on,providers:Array.isArray(cfg.providers)?cfg.providers:[],
  async session(){if(!on)return null;const c=await load();const {data}=await c.auth.getSession();return data.session||null},
  async signUp(email,password){const c=await load();const {data,error}=await c.auth.signUp({email,password,options:{emailRedirectTo:studio()}});if(error)throw error;
    // Someone signing up again with an email that already has an account gets a user with no identities.
    if(!data.session&&data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length)throw Error('User already registered');return data.session||null},
  async resend(email){const c=await load();const {error}=await c.auth.resend({type:'signup',email,options:{emailRedirectTo:studio()}});if(error)throw error},
  async resetPassword(email){const c=await load();const {error}=await c.auth.resetPasswordForEmail(email,{redirectTo:page('reset.html')});if(error)throw error},
  async updatePassword(password){const c=await load();const {data,error}=await c.auth.updateUser({password});if(error)throw error;return data.user},
  async signIn(email,password){const c=await load();const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;return data.session},
  async email(address){const c=await load();const {error}=await c.auth.signInWithOtp({email:address,options:{emailRedirectTo:studio(),shouldCreateUser:true}});if(error)throw error},
  async provider(name){const c=await load();const {error}=await c.auth.signInWithOAuth({provider:name,options:{redirectTo:studio()}});if(error)throw error},
  async signOut(scope){if(!on)return;const c=await load();await c.auth.signOut(scope?{scope}:undefined)},
  // The account page: fresh user details from the server, name (user_metadata.name), new email (confirmed by email).
  async user(){const c=await load();const {data,error}=await c.auth.getUser();if(error)throw error;return data.user},
  async updateProfile(data){const c=await load();const {data:d,error}=await c.auth.updateUser({data});if(error)throw error;return d.user},
  async changeEmail(email){const c=await load();const {error}=await c.auth.updateUser({email},{emailRedirectTo:page('account.html')});if(error)throw error},
  // Deletes the signed-in account for good (api/delete-account.js), then signs out on this device.
  async deleteAccount(){const c=await load(),{data}=await c.auth.getSession(),t=data.session?.access_token;if(!t)throw Error('Please sign in again.');
    const r=await fetch('/api/delete-account',{method:'POST',headers:{authorization:'Bearer '+t}});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'We couldn’t delete the account.');
    await c.auth.signOut({scope:'local'}).catch(()=>{})},
  async onChange(fn){if(!on)return;const c=await load();c.auth.onAuthStateChange((_e,s)=>fn(s))}};
})();
