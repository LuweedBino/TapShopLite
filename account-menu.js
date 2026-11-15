// (Menu buttons carry an inline background so the editor theme's catch-all button style, which skips
// buttons with [style*=background], leaves them alone.)
// The 👤 account menu, at the top of the start screen (#vsAcct) and the editor's top bar: who's signed in,
// My account (account.html), Invite a friend (share sheet or copy link), Home page, Sign out.
// Only when sign-in is on (TapAuth.on). Loaded after video-topbar.js, which builds the editor's top bar rows.
(()=>{
if(!window.TapAuth||!TapAuth.on)return;
const SITE='https://tapshoplite.app/',esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const say=t=>typeof toast==='function'?toast(t):alert(t);
window.veInvite=async function(){const text='I make my short videos with TapShopLite. It’s free right now, try it:';
  if(navigator.share){try{await navigator.share({title:'TapShopLite',text,url:SITE});return}catch(e){if(e?.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(text+' '+SITE);say('Invite link copied. Paste it in a text, DM or email.')}catch{prompt('Copy this link and send it to a friend:',SITE)}};
const st=document.createElement('style');st.textContent=`
.am-btn{display:grid!important;place-items:center;width:34px!important;height:34px!important;padding:0!important;border-radius:50%!important;border:1px solid var(--ts-border,#8a7aa855);background:none;font-size:15px;font-weight:800;cursor:pointer;color:inherit;flex:none;text-decoration:none}
.am-btn.has{background:#ff3ea5;color:#fff;border-color:#ff3ea5}
.am-menu{position:fixed;z-index:9999;width:min(270px,calc(100vw - 16px));background:var(--ts-surface,#1b1922);color:var(--ts-text,#f4f1f7);border:1px solid var(--ts-border,#8a7aa855);border-radius:16px;padding:6px;box-shadow:0 14px 40px #0006;font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body.light .am-menu,html:not(.ts-dark) body .am-menu{background:#fff;color:#16141c;border-color:#e7e2ec;box-shadow:0 14px 40px #0002}
.am-who{padding:10px 10px 12px;border-bottom:1px solid var(--ts-border,#8a7aa833);margin-bottom:4px}.am-who b{display:block;font-size:15px}.am-who small{opacity:.65;word-break:break-all}
html body .am-menu button,html body .am-menu a{display:flex!important;align-items:center;gap:10px;width:100%;min-height:42px!important;height:auto!important;padding:0 10px!important;border:0!important;outline:0;background:none!important;color:inherit!important;font:inherit!important;text-align:left;border-radius:10px!important;cursor:pointer;text-decoration:none;box-shadow:none!important}
html body .am-menu button:hover,html body .am-menu a:hover,html body .am-menu button:focus-visible,html body .am-menu a:focus-visible{background:#ff3ea51f!important}
html body .am-menu .am-out{color:#e5484d!important}`;document.head.appendChild(st);
let menu=null,user=null;
TapAuth.session().then(s=>{user=s?.user||null;paint()}).catch(()=>{});
const initial=()=>{const n=user?.user_metadata?.name||user?.email||'';return n?n.trim()[0].toUpperCase():'👤'};
function paint(){document.querySelectorAll('.am-btn').forEach(b=>{b.textContent=initial();b.classList.toggle('has',!!user);if(user&&b.style.background)b.style.background='#ff3ea5'})}
function close(){menu?.remove();menu=null;document.querySelectorAll('.am-btn').forEach(b=>b.setAttribute('aria-expanded','false'))}
function open(btn){if(menu){close();return}const name=user?.user_metadata?.name;
  menu=document.createElement('div');menu.className='am-menu';menu.setAttribute('role','menu');
  menu.innerHTML=`<div class="am-who"><b>${esc(name||'Your account')}</b><small>${esc(user?.email||'')}</small></div>
  <a role="menuitem" href="account.html">👤 My account</a><button type="button" role="menuitem" data-a="invite" style="background:none">💌 Invite a friend</button>
  <a role="menuitem" href="./">🏠 Home page</a><button type="button" role="menuitem" class="am-out" data-a="out" style="background:none">🚪 Sign out</button>`;
  document.body.appendChild(menu);const r=btn.getBoundingClientRect(),w=menu.offsetWidth;
  menu.style.top=Math.round(r.bottom+8)+'px';menu.style.left=Math.round(Math.max(8,Math.min(innerWidth-w-8,r.right-w)))+'px';
  btn.setAttribute('aria-expanded','true');anchor=btn;at=btn.getBoundingClientRect();menu.querySelector('a,button').focus({preventScroll:true});
  menu.onclick=async e=>{const a=e.target.closest('[data-a]')?.dataset.a;if(!a)return;close();
    if(a==='invite')veInvite();
    if(a==='out'){await TapAuth.signOut().catch(()=>{});location.href='./'}}}
function wire(btn){btn.classList.add('am-btn');btn.setAttribute('aria-haspopup','menu');btn.setAttribute('aria-expanded','false');btn.title='Your account';
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open(btn)})}
document.addEventListener('click',e=>{if(menu&&!menu.contains(e.target))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu)close()});
// Close when the page moves under the menu, but not for strips that scroll by themselves (the Quick tips strip, the toolbar glide):
// on phones those fire scroll events all the time and used to shut the menu the moment it opened.
let anchor=null,at=null;const moved=()=>{if(!menu||!anchor)return;const r=anchor.getBoundingClientRect();if(Math.abs(r.top-at.top)>4||Math.abs(r.left-at.left)>4)close()};
addEventListener('resize',moved);addEventListener('scroll',moved,true);
// Start screen: the existing 👤 link becomes the menu button.
const start=document.getElementById('vsAcct');if(start){start.hidden=false;wire(start)}
// Editor: a matching button at the right of the top bar's first row, before the light/dark switch.
const row=document.querySelector('header.top .vt-row1')||document.querySelector('header.top');
if(row){const b=document.createElement('button');b.type='button';b.id='veAcct';b.style.background='none';b.setAttribute('aria-label','Your account');const theme=row.querySelector('.theme-toggle');theme?theme.before(b):row.appendChild(b);wire(b)}
paint();
})();
