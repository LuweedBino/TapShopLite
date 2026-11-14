// Resize and move videos on the preview, like text and shapes. Tap a video on the preview to pick it: a pink box
// with four corner handles shows. Drag inside to move it, drag a corner to make it bigger or smaller (it keeps its
// shape), double-tap to put it back to normal. Works for main clips (new clip fields zoom, px, py: size ×, and
// shift as a share of the frame; missing = normal) and video layers (their own x, y, scale). Text and shapes on top
// win the tap. Drawn through clipMotion and the layer drawing, so the preview and both exports match. Undo-able.
(()=>{
let picked=null,gest=null,lastTap={t:0,key:''};
const W=()=>canvas.width,H=()=>canvas.height;
// Main clips: fold the clip's own size and shift into its movement, so draw() (preview and exports) uses them.
const baseMotion=clipMotion;clipMotion=function(p,t,w,h){const m=baseMotion(p,t,w,h),c=p.c;m.s*=c.zoom||1;m.dx+=(c.px||0)*w;m.dy+=(c.py||0)*h;return m};
const layerOn=t=>t.type==='video'&&!t.hidden&&t.media&&(t.media.readyState>=2||t.media._frame)&&playhead>=t.offset&&playhead<t.offset+(t.end-t.start)/(t.speed||1);
function box(k){if(k.kind==='layer'){const t=extraTracks.find(x=>x.id===k.id);if(!t||!layerOn(t))return null;const v=t.media,w=W()*t.scale/100,h=w*(v.videoHeight||9)/(v.videoWidth||16);return {x:W()*t.x/100-w/2,y:H()*t.y/100-h/2,w,h}}
  const p=at(playhead);if(!p||p.c.id!==k.id)return null;const v=asset(p.c)?.video;if(!v?.videoWidth)return null;
  const f=p.c.fit==='cover'?Math.max(W()/v.videoWidth,H()/v.videoHeight):Math.min(W()/v.videoWidth,H()/v.videoHeight),m=clipMotion(p,playhead,W(),H()),w=v.videoWidth*f*m.s,h=v.videoHeight*f*m.s;
  return {x:(W()-w)/2+m.dx,y:(H()-h)/2+m.dy,w,h}}
// Corner handles, kept inside the frame so a filled (bigger than the frame) video can still be resized.
function corners(b){const r=handleRadius()*1.2,cl=(v,a)=>Math.max(r,Math.min(a-r,v));return [[cl(b.x,W()),cl(b.y,H())],[cl(b.x+b.w,W()),cl(b.y,H())],[cl(b.x+b.w,W()),cl(b.y+b.h,H())],[cl(b.x,W()),cl(b.y+b.h,H())]]}
function hit(pt){for(const t of [...extraTracks].reverse()){if(!layerOn(t))continue;const b=box({kind:'layer',id:t.id});if(b&&pt.x>=b.x&&pt.x<=b.x+b.w&&pt.y>=b.y&&pt.y<=b.y+b.h)return {kind:'layer',id:t.id}}
  const p=at(playhead);if(p){const b=box({kind:'clip',id:p.c.id});if(b&&pt.x>=Math.max(0,b.x)&&pt.x<=Math.min(W(),b.x+b.w)&&pt.y>=Math.max(0,b.y)&&pt.y<=Math.min(H(),b.y+b.h))return {kind:'clip',id:p.c.id}}return null}
const item=k=>k.kind==='layer'?extraTracks.find(x=>x.id===k.id):clips.find(c=>c.id===k.id);
// The pink box and handles (never in exports).
const baseDraw=draw;draw=function(){baseDraw();if(!picked||exporting||(typeof veRendering!=='undefined'&&veRendering))return;const b=box(picked);if(!b){return}
  const r=handleRadius();ctx.save();ctx.strokeStyle='#ff3ea5';ctx.lineWidth=Math.max(2,r*.35);ctx.setLineDash([r*1.2,r*.8]);ctx.strokeRect(Math.max(0,b.x),Math.max(0,b.y),Math.min(W(),b.x+b.w)-Math.max(0,b.x),Math.min(H(),b.y+b.h)-Math.max(0,b.y));ctx.setLineDash([]);
  ctx.fillStyle='#fff';for(const [x,y] of corners(b)){ctx.beginPath();ctx.arc(x,y,r*.95,0,Math.PI*2);ctx.fill();ctx.stroke()}ctx.restore()};
// Runs after the text/shape handlers: if they took the tap (a text or shape was hit), the video lets go.
canvas.addEventListener('pointerdown',e=>{if(exporting||e.button!==0)return;if(e.defaultPrevented){if(picked){picked=null;draw()}return}
  const pt=canvasPoint(e),r=hitRadius(e);let onHandle=-1;
  if(picked){const b=box(picked);if(b)onHandle=corners(b).findIndex(([x,y])=>Math.hypot(pt.x-x,pt.y-y)<=r)}
  const k=onHandle>=0?picked:hit(pt);if(!k){if(picked){picked=null;draw()}return}
  const key=k.kind+k.id,now=performance.now();
  if(onHandle<0&&lastTap.key===key&&now-lastTap.t<350){lastTap={t:0,key:''};pause();snapshot();const it=item(k);if(k.kind==='layer')Object.assign(it,{x:50,y:50,scale:100});else{delete it.zoom;delete it.px;delete it.py}picked=k;draw();toast('Back to normal size.');e.preventDefault();return}
  lastTap={t:now,key};e.preventDefault();pause();picked=k;try{pickedStrip={kind:k.kind==='layer'?'extra':'main',id:k.id};decorateStrips()}catch{}const b=box(k),it=item(k);if(!b||!it)return;
  const cx=b.x+b.w/2,cy=b.y+b.h/2;gest={k,start:pt,cx,cy,d0:Math.max(1,Math.hypot(pt.x-cx,pt.y-cy)),resize:onHandle>=0,
    o:k.kind==='layer'?{x:it.x,y:it.y,scale:it.scale}:{zoom:it.zoom||1,px:it.px||0,py:it.py||0}};
  canvas.setPointerCapture(e.pointerId);canvas.style.cursor=gest.resize?'nwse-resize':'grabbing';draw()});
canvas.addEventListener('pointermove',e=>{if(!gest)return;const pt=canvasPoint(e),g=gest,it=item(g.k);if(!it)return;
  if(!g.snap){if(Math.hypot(pt.x-g.start.x,pt.y-g.start.y)<2)return;snapshot();g.snap=true}
  if(g.resize){const ratio=Math.hypot(pt.x-g.cx,pt.y-g.cy)/g.d0;if(g.k.kind==='layer')it.scale=Math.max(5,Math.min(400,Math.round(g.o.scale*ratio*10)/10));else it.zoom=Math.max(.2,Math.min(5,Math.round(g.o.zoom*ratio*1000)/1000))}
  else{const dx=pt.x-g.start.x,dy=pt.y-g.start.y;if(g.k.kind==='layer'){it.x=Math.round((g.o.x+dx/W()*100)*10)/10;it.y=Math.round((g.o.y+dy/H()*100)*10)/10}else{it.px=Math.round((g.o.px+dx/W())*1000)/1000;it.py=Math.round((g.o.py+dy/H())*1000)/1000}}
  draw()});
const end=()=>{if(!gest)return;const g=gest;gest=null;canvas.style.cursor='default';if(g.k.kind==='layer')renderTracks();draw()};
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
// Let go when the picked video leaves the screen (another time, deleted) so the box never points at nothing.
const baseSeek=seekTimeline;seekTimeline=async function(t){const r=await baseSeek(t);if(picked&&!box(picked)){picked=null;draw()}return r};
window.vePickedVideo=()=>picked;
})();
