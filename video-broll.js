// B-roll Video Maker (called the B-roll builder in older notes): drop in clips, pick a story template (Hook → Problem → Solution → Call to action, …),
// and the builder looks at and listens to each clip in the browser (CLIP for pictures and Whisper for
// speech, both via transformers.js from jsDelivr in a Web Worker; models download once from Hugging Face
// and the browser caches them), puts every clip in the part of the story it fits best, lets the creator
// fix the order, then builds the video: clips cut to the beat, words on screen for each part, and a beat
// made right here in the browser (WebAudio, so it's free to use) on its own audio track.
(()=>{
const LIB='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const $$=id=>document.getElementById(id);
const enc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- what the picture AI looks for ----------
// [key, prompt for the AI, short name shown to the creator]
const LOOKS=[
  ['talk','a person talking to the camera','🗣 Talking to camera'],
  ['product','a close-up photo of a product','📦 Product close-up'],
  ['unbox','hands opening a package or box','🎁 Unboxing'],
  ['messy','a messy, dirty or cluttered place','😩 Messy / before'],
  ['clean','a clean, tidy and finished result','✨ Clean / after'],
  ['using','a person using a product with their hands','🙌 Using it'],
  ['happy','a smiling, happy person','😊 Happy'],
  ['upset','a frustrated or tired person','😣 Frustrated'],
  ['screen','a phone screen or a website','📱 Phone / screen'],
  ['food','food or a drink','🍽 Food / drink'],
  ['beauty','makeup, skincare or hair','💄 Beauty'],
  ['outside','an outdoor scene or a place','🌳 Outdoors'],
];

// ---------- story templates ----------
// look: what the part's pictures usually show (weights); say: words people usually say in that part.
const S=(id,label,text,look,say,o={})=>({id,label,text,look,say,...o});
const HOOK=S('hook','Hook','Wait… you NEED this 👀',{talk:1,product:.6,happy:.3},/\b(wait|stop|you need|obsessed|game ?changer|i found|nobody|pov|okay so|you guys|listen|this is|watch)\b/i,{y:22,box:'#ff3ea5',anim:'pop',textMax:3.5,beats:4});
const CTA=S('cta','Call to action','Link in bio 👇',{talk:.8,screen:.7,product:.5,happy:.3},/\b(link|bio|grab|get yours|get it|shop|buy|code|discount|check it out|click|order|follow|comment|tap)\b/i,{y:78,box:'#ffd84d',color:'#111111',anim:'bounce',beats:6});
const TEMPLATES=[
  {id:'pas',name:'Hook → Problem → Solution',tag:'The classic UGC ad',mood:'bright',parts:[HOOK,
    S('problem','Problem','The problem? 😩',{upset:1,messy:1,talk:.3},/\b(tired of|hate|struggl|problem|annoying|never works|always|messy|hard to|sick of|used to|ugh|frustrat|can'?t)\b/i,{y:20,box:'#111111',anim:'left',beats:6}),
    S('solution','Solution','Then I found this ✨',{using:1,product:.7,clean:.5,happy:.4},/\b(so i|tried|found|works|changed|now i|fixed|solves|love how|use it|just|this one|it's so)\b/i,{y:20,box:'#ffffff',color:'#111111',anim:'pop',beats:8}),
    CTA]},
  {id:'beforeafter',name:'Before → After',tag:'Show the glow-up',mood:'upbeat',parts:[HOOK,
    S('before','Before','BEFORE',{messy:1,upset:.7},/\b(before|used to|was|look at this|look how)\b/i,{y:12,box:'#111111',anim:'left',beats:8}),
    S('after','After','AFTER ✨',{clean:1,happy:.6,product:.3},/\b(after|now|look at|wow|so much better|finally)\b/i,{y:12,box:'#ffffff',color:'#111111',anim:'pop',beats:8}),
    CTA]},
  {id:'reasons',name:'3 reasons I love it',tag:'Quick reasons people save',mood:'upbeat',parts:[S('hook','Hook','3 reasons I love this 💕',HOOK.look,HOOK.say,{...HOOK,text:'3 reasons I love this 💕'}),
    S('r1','Reason 1','Reason #1 💡',{using:1,product:.8,happy:.3},/\b(first|one|number one|reason one|1)\b/i,{y:18,box:'#7c3aed',anim:'pop',beats:6}),
    S('r2','Reason 2','Reason #2 🙌',{using:.9,product:.8,clean:.3},/\b(second|two|also|plus|another|2)\b/i,{y:18,box:'#7c3aed',anim:'pop',beats:6}),
    S('r3','Reason 3','Reason #3 😍',{happy:1,using:.6,clean:.5},/\b(third|three|finally|best part|last|3)\b/i,{y:18,box:'#7c3aed',anim:'pop',beats:6}),
    CTA]},
  {id:'unboxing',name:'Unboxing',tag:'First look at something new',mood:'bright',parts:[S('hook','Hook','It’s finally here! 📦',HOOK.look,HOOK.say,{...HOOK,text:'It’s finally here! 📦'}),
    S('open','Unboxing','Let’s open it 🎁',{unbox:1.2,product:.4,using:.3},/\b(open|unbox|box|package|arrived|came|inside)\b/i,{y:18,box:'#111111',anim:'down',beats:8}),
    S('look','First look','First look 👀',{product:1.1,clean:.4},/\b(look|comes with|inside|feel|quality|size|color|colour)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'pop',beats:6}),
    S('fav','Favourite part','My favourite part 😍',{using:1,happy:.8},/\b(favou?rite|love|best|obsessed|amazing|so good)\b/i,{y:18,box:'#ff3ea5',anim:'pop',beats:6}),
    CTA]},
  {id:'howto',name:'How to use it',tag:'A quick step-by-step',mood:'bright',parts:[S('hook','Hook','Here’s how I use it 👇',HOOK.look,HOOK.say,{...HOOK,text:'Here’s how I use it 👇'}),
    S('s1','Step 1','Step 1 ☝️',{using:1,product:.6,unbox:.3},/\b(first|step one|start|open|take)\b/i,{y:18,box:'#111111',anim:'left',beats:6}),
    S('s2','Step 2','Step 2 ✌️',{using:1,product:.4},/\b(then|next|step two|after that|second)\b/i,{y:18,box:'#111111',anim:'left',beats:6}),
    S('s3','Step 3','Step 3 🤟',{using:.9,clean:.4},/\b(finally|last|step three|third|and then)\b/i,{y:18,box:'#111111',anim:'left',beats:6}),
    S('result','Result','The result 😍',{clean:1,happy:.8,product:.3},/\b(result|look at|done|that's it|and now|wow)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'pop',beats:8}),
    CTA]},
  {id:'myth',name:'Myth vs truth',tag:'Bust a common belief',mood:'upbeat',parts:[S('hook','Hook','You’ve been told this… 🤔',HOOK.look,HOOK.say,{...HOOK,text:'You’ve been told this… 🤔'}),
    S('myth','The myth','MYTH ❌',{upset:.8,messy:.6,talk:.5},/\b(myth|they say|people think|you've been told|everyone says|wrong|lie)\b/i,{y:16,box:'#e11d48',anim:'left',beats:6}),
    S('truth','The truth','TRUTH ✅',{talk:.6,product:.6,using:.5},/\b(truth|actually|in fact|really|the real|turns out)\b/i,{y:16,box:'#16a34a',anim:'pop',beats:6}),
    S('proof','The proof','Here’s the proof 👀',{using:1,clean:.7,product:.5,screen:.3},/\b(proof|look|see|show|results|watch)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'pop',beats:8}),
    CTA]},
  {id:'dayinlife',name:'Day in my life',tag:'Your day, with it in it',mood:'chill',parts:[S('hook','Morning','A day in my life ☀️',{outside:.6,food:.5,happy:.5,talk:.3},/\b(morning|wake|day in|good morning|coffee)\b/i,{y:16,box:'#ff3ea5',anim:'pop',textMax:3.5,beats:6}),
    S('use','Using it','How it fits in my day ✨',{using:1,product:.6,beauty:.3,food:.3},/\b(use|using|routine|every day|daily|part of)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'fade',beats:8}),
    S('moment','The moment','My favourite moment 💛',{happy:1,outside:.5,food:.4},/\b(love|favou?rite|best|moment|feel)\b/i,{y:18,box:'#111111',anim:'fade',beats:8}),
    S('night','Wrap-up','Would recommend 💯',{talk:.8,happy:.5,product:.4},/\b(night|end of|recommend|would|wrap)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'fade',beats:6}),
    CTA]},
  {id:'versus',name:'This vs that',tag:'Old way vs new way',mood:'upbeat',parts:[S('hook','Hook','Stop doing it the old way 🛑',HOOK.look,HOOK.say,{...HOOK,text:'Stop doing it the old way 🛑'}),
    S('old','The old way','The old way 😩',{messy:1,upset:.8},/\b(old|used to|before|instead of|normal|regular|other)\b/i,{y:16,box:'#111111',anim:'left',beats:6}),
    S('new','The new way','The new way 😎',{using:1,product:.7,clean:.6},/\b(new|now|this|instead|switch|upgrade)\b/i,{y:16,box:'#ffffff',color:'#111111',anim:'pop',beats:8}),
    S('why','Why it wins','Why it wins 🏆',{happy:.8,clean:.7,product:.5,talk:.3},/\b(because|why|better|faster|easier|cheaper|saves|wins)\b/i,{y:16,box:'#ff3ea5',anim:'pop',beats:6}),
    CTA]},
  {id:'pov',name:'POV / storytime',tag:'Tell it like a story',mood:'chill',parts:[S('hook','The hook','POV: you finally found it 🫠',{talk:.8,upset:.4,happy:.3},/\b(pov|storytime|so this happened|let me tell|story)\b/i,{y:22,box:'#111111',anim:'fade',textMax:3.5,beats:6}),
    S('moment','The moment','It all started when… 👀',{upset:.7,messy:.6,talk:.5,outside:.3},/\b(so|then|when|started|one day|happened)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'fade',beats:8}),
    S('twist','The twist','Then THIS happened 😳',{happy:.7,product:.6,unbox:.4},/\b(but|then|suddenly|turns out|twist|until)\b/i,{y:18,box:'#ff3ea5',anim:'pop',beats:6}),
    S('product','The product','This is what changed it ✨',{product:1,using:.8},/\b(this|product|changed|found|it's called)\b/i,{y:18,box:'#ffffff',color:'#111111',anim:'pop',beats:8}),
    CTA]},
  {id:'honest',name:'Honest review',tag:'The good, the bad, the verdict',mood:'bright',parts:[S('hook','Hook','My honest review 📝',HOOK.look,HOOK.say,{...HOOK,text:'My honest review 📝'}),
    S('good','The good','The good 👍',{happy:1,using:.7,clean:.5},/\b(love|good|great|like|amazing|pros?)\b/i,{y:16,box:'#16a34a',anim:'pop',beats:6}),
    S('bad','The not-so-good','The not-so-good 👎',{upset:.8,talk:.5,product:.3},/\b(but|don't|not|wish|only thing|cons?|downside|bad)\b/i,{y:16,box:'#e11d48',anim:'left',beats:6}),
    S('verdict','The verdict','The verdict ⭐⭐⭐⭐⭐',{talk:.8,product:.6,happy:.5},/\b(overall|verdict|worth|would|recommend|rating|out of)\b/i,{y:16,box:'#ffd84d',color:'#111111',anim:'bounce',beats:6}),
    CTA]},
];

// ---------- free beats, made in the browser ----------
// ▶ Listen plays 10 seconds of the chosen beat; it stops when the mood changes, it's tapped again or the dialog closes.
let preview=null;
function stopListen(){if(preview){preview.pause();URL.revokeObjectURL(preview.src);preview=null}let b=document.getElementById('brListen');if(b){b.textContent='▶ Listen';b.disabled=false}}
async function listen(){let b=document.getElementById('brListen');if(preview){stopListen();return}if(!mood){toast('Pick some music first.');return}if(mood==='auto'){toast('We’ll choose the music after looking at your clips. Pick a style here to hear it.');return}
  b.disabled=true;b.textContent='…';try{let f=await makeBeat(10,mood);preview=new Audio(URL.createObjectURL(f));preview.onended=stopListen;await preview.play();b.textContent='■ Stop';b.disabled=false}catch(e){stopListen();toast('Couldn’t play the music here.')}}
const MOODS={
  bright:{name:'Bright pop',bpm:104,chords:[[60,'maj'],[67,'maj'],[69,'min'],[65,'maj']],kick:[0,8,10],snare:[4,12],hats:2,arp:2,pad:1300},
  upbeat:{name:'Upbeat dance',bpm:122,chords:[[62,'min'],[58,'maj'],[65,'maj'],[60,'maj']],kick:[0,4,8,12],snare:[4,12],hats:2,open:[2,6,10,14],arp:1,pad:1600},
  chill:{name:'Chill lo-fi',bpm:86,chords:[[57,'min7'],[53,'maj7'],[60,'maj7'],[55,'maj']],kick:[0,7,10],snare:[8],hats:2,swing:.12,arp:4,pad:850},
  // Optional fields (missing = the original sound): bass saw|sub|pluck|none, bassPat (steps), lead triangle|square|sine|bell,
  // arpDown, clap/rim (steps), roll (hat steps split in three), hats 0 = none, drums false = no drums, padType, padVol, chordBars, boom (long kick).
  // lead can also be piano or guitar (a plucked string). Every style's tune is in MEL below.
  trap:{name:'Trap bounce',bpm:140,chords:[[57,'min'],[53,'maj'],[60,'maj'],[55,'maj']],kick:[0,7,10],snare:[8],clap:[8],hats:1,roll:[6,14],bass:'sub',bassPat:[0,7,10],boom:1,arp:4,lead:'bell',pad:900,padVol:.6},
  rnb:{name:'Smooth R&B',bpm:72,chords:[[62,'m9'],[67,'dom7'],[60,'maj7'],[57,'m9']],kick:[0,7,10],snare:[8],rim:[4,14],hats:2,swing:.1,bass:'sub',bassPat:[0,7,10],arp:4,lead:'sine',pad:1000,padType:'sine',padVol:1.2},
  acoustic:{name:'Happy acoustic',bpm:110,chords:[[60,'add9'],[67,'maj'],[69,'min'],[65,'add9']],kick:[0,8],clap:[4,12],snare:[],hats:4,bass:'pluck',arp:1,lead:'triangle',pad:900,padType:'sine'},
  tropical:{name:'Tropical house',bpm:108,chords:[[64,'min7'],[60,'maj7'],[67,'maj'],[62,'maj']],kick:[0,4,8,12],snare:[],clap:[4,12],open:[2,6,10,14],hats:4,bass:'pluck',bassPat:[2,6,10,14],arp:2,lead:'bell',pad:1400},
  inspire:{name:'Inspiring corporate',bpm:116,chords:[[60,'add9'],[64,'min'],[65,'add9'],[67,'sus4']],kick:[0,8],snare:[4,12],hats:2,arp:1,lead:'sine',pad:1500},
  epic:{name:'Epic cinematic',bpm:90,chords:[[57,'min'],[53,'maj'],[48,'maj'],[55,'maj']],kick:[0,3,10],snare:[8],hats:0,boom:1,bass:'saw',bassPat:[0,8],arp:2,lead:'square',pad:1800,padVol:1.8,chordBars:2},
  dreamy:{name:'Dreamy ambient',bpm:70,chords:[[60,'maj7'],[57,'m9'],[65,'maj7'],[67,'sus2']],drums:false,bass:'sub',bassPat:[0],arp:4,lead:'bell',pad:1100,padType:'sine',padVol:1.5,chordBars:2},
  funk:{name:'Funky groove',bpm:112,chords:[[62,'m9'],[67,'dom7']],kick:[0,3,8,11],snare:[4,12],hats:2,open:[6,14],bass:'pluck',bassPat:[0,3,6,8,10,11,14],arp:4,lead:'square',pad:1300},
  synthwave:{name:'Retro synthwave',bpm:100,chords:[[57,'min'],[53,'maj'],[60,'maj'],[55,'maj']],kick:[0,8],snare:[4,12],hats:2,bass:'saw',bassPat:[0,2,4,6,8,10,12,14],arp:1,lead:'square',pad:2000},
  boombap:{name:'Boom bap hip-hop',bpm:90,chords:[[57,'min7'],[62,'min7']],kick:[0,7,10],snare:[4,12],hats:2,swing:.14,bass:'sub',bassPat:[0,7,10],arp:8,lead:'triangle',pad:800},
  afro:{name:'Afrobeats',bpm:104,chords:[[61,'min7'],[66,'maj7'],[68,'maj'],[64,'maj']],kick:[0,6,10],snare:[],rim:[3,7,11,14],clap:[4,12],hats:2,open:[14],bass:'pluck',bassPat:[0,6,10,13],arp:2,lead:'bell',pad:1200},
  reggaeton:{name:'Reggaeton',bpm:96,chords:[[57,'min'],[53,'maj'],[60,'maj'],[55,'maj']],kick:[0,4,8,12],snare:[3,6,11,14],hats:4,bass:'sub',bassPat:[0,3,8,11],arp:4,lead:'square',pad:1200},
  dnb:{name:'Drum & bass rush',bpm:172,chords:[[57,'min'],[53,'maj'],[55,'maj'],[52,'min']],kick:[0,10],snare:[4,12],hats:2,bass:'sub',bassPat:[0,10],arp:4,lead:'sine',pad:1500,chordBars:2},
  futurebass:{name:'Future bass',bpm:150,chords:[[65,'add9'],[69,'min7'],[67,'sus4'],[64,'min7']],kick:[0,10],snare:[8],clap:[8],hats:2,roll:[14],bass:'sub',bassPat:[0,10],arp:2,lead:'bell',pad:2600,padVol:1.5},
  jazz:{name:'Jazzy café',bpm:92,chords:[[62,'min7'],[67,'dom7'],[60,'maj7'],[57,'dom7']],kick:[0,10],snare:[],rim:[4,12],hats:2,swing:.16,bass:'pluck',bassPat:[0,4,8,12],arp:4,lead:'sine',pad:900,padType:'sine',padVol:1.6},
  hype:{name:'Hype sports',bpm:128,chords:[[57,'pow'],[53,'pow'],[55,'pow'],[52,'pow']],kick:[0,4,8,12],snare:[4,12],clap:[4,12],hats:2,open:[2,6,10,14],bass:'saw',bassPat:[0,2,4,6,8,10,12,14],arp:2,lead:'square',pad:2200},
  playful:{name:'Cute & playful',bpm:120,chords:[[60,'maj'],[65,'maj'],[67,'maj'],[60,'maj']],kick:[0,8],snare:[],clap:[4,12],hats:4,bass:'pluck',bassPat:[0,4,8,12],arp:2,lead:'square',pad:1000,padType:'sine'},
  dark:{name:'Dark & moody',bpm:80,chords:[[57,'min'],[56,'maj'],[53,'maj'],[52,'pow']],kick:[0,10],snare:[8],hats:4,boom:1,bass:'sub',bassPat:[0,10],arp:8,lead:'sine',pad:600,padVol:1.4,chordBars:2},
  holiday:{name:'Holiday sparkle',bpm:110,chords:[[60,'maj'],[64,'min'],[65,'maj'],[67,'dom7']],kick:[0,8],snare:[4,12],hats:2,open:[6,14],bass:'pluck',arp:1,lead:'bell',pad:1400},
  piano:{name:'Gentle piano',bpm:76,chords:[[60,'maj7'],[57,'min7'],[65,'maj7'],[67,'sus4']],kick:[0,10],snare:[],rim:[8],hats:4,bass:'sub',bassPat:[0,8],arp:4,lead:'piano',pad:700,padType:'sine',padVol:.8},
  guitar:{name:'Campfire guitar',bpm:96,chords:[[67,'maj'],[64,'min'],[60,'maj'],[62,'maj']],kick:[0,8],snare:[4,12],hats:4,bass:'pluck',bassPat:[0,6,8,14],arp:2,lead:'guitar',pad:800,padType:'sine',padVol:.6},
  bossa:{name:'Bossa nova',bpm:126,chords:[[62,'min7'],[67,'dom7'],[60,'maj7'],[60,'maj7']],kick:[0,3,8,11],snare:[],rim:[0,3,6,10,13],hats:2,bass:'pluck',bassPat:[0,3,8,11],arp:4,lead:'guitar',pad:900,padType:'sine',padVol:1.1},
  gospel:{name:'Soulful gospel',bpm:72,chords:[[53,'maj7'],[57,'min7'],[58,'maj7'],[60,'dom7']],kick:[0,10],snare:[8],clap:[8],hats:2,swing:.12,bass:'sub',bassPat:[0,7,10],arp:4,lead:'piano',pad:1000,padType:'sine',padVol:1.3},
  kids:{name:'Kids cartoon',bpm:132,chords:[[60,'maj'],[67,'maj'],[65,'maj'],[67,'maj']],kick:[0,8],snare:[],clap:[4,12],hats:4,bass:'pluck',bassPat:[0,4,8,12],arp:4,lead:'bell',pad:1200,padType:'sine'},
  workout:{name:'Workout pump',bpm:132,chords:[[62,'min'],[58,'maj'],[60,'maj'],[57,'min']],kick:[0,4,8,12],clap:[4,12],snare:[],hats:2,open:[2,6,10,14],bass:'saw',bassPat:[2,6,10,14],arp:2,lead:'square',pad:1700},
};
// Each style's own tune: two one-bar phrases, played A A B A. 16 steps a bar: a number is a note of the chord
// playing at the time (0 = root, 1 = next chord note up…, past the top goes up an octave, negative goes down),
// "-" holds the note, "." is a rest. Using chord notes keeps every tune in tune with any chords.
const MEL={
  bright:['2 . 2 . 1 - 0 . 1 . 2 - - - . .','3 . 2 . 1 . 2 - 1 - 0 - - - . .'],
  upbeat:['0 . 0 2 . 0 1 . 2 . 3 - 2 . 1 .','3 - 2 . 3 - 4 . 3 . 2 . 1 - . .'],
  chill:['2 - - 1 . . 0 - - . . . 1 - 0 .','3 - - 2 . 1 - . 0 - - - . . . .'],
  trap:['0 . 0 . 2 . . 1 . . 0 . -1 - . .','3 . 2 . 3 . . 2 . . 1 . 0 - . .'],
  rnb:['. . 2 - 3 - 2 1 - - 0 - . . . .','. 4 - 3 2 - 1 - 2 - - - . . . .'],
  acoustic:['0 1 2 - 2 - 1 0 1 - 2 - 0 - . .','3 - 2 1 2 - 1 0 1 - 0 - - - . .'],
  tropical:['. . 2 . 2 . 3 . . 2 . 1 . . 0 .','. . 3 . 3 . 4 . . 3 . 2 . 1 . .'],
  inspire:['0 - 1 - 2 - - - 3 - 2 - 1 - - -','2 - 3 - 4 - - - 3 - - - 2 - - -'],
  epic:['0 - - - 1 - - - 2 - - - 1 - 0 -','3 - - - 2 - - - 4 - - - 3 - - -'],
  dreamy:['3 - - - - - 2 - - - - - 1 - - -','4 - - - - - 3 - - - 2 - - - - -'],
  funk:['0 . 0 2 . 0 . 3 . 0 2 . 1 . 0 .','. 3 . 2 . 3 4 . 3 . 2 . 0 . . .'],
  synthwave:['2 - - 3 - - 4 - 3 - 2 - 1 - - -','4 - - 3 - - 2 - 3 - - - 1 - - -'],
  boombap:['. . 2 . . 1 . . 0 - . . -1 . . .','. . 3 . . 2 . 1 . . 0 - . . . .'],
  afro:['0 . 1 . . 2 . 1 . 0 . . 2 . 1 .','3 . 2 . . 3 . 2 . 1 . . 0 . . .'],
  reggaeton:['2 . . 2 . . 1 . 2 . . 2 . . 3 .','3 . . 2 . . 1 . 0 . . 1 . . 2 .'],
  dnb:['3 - - - 2 - - - 4 - - - 3 - 2 -','4 - 3 - 2 - - - 1 - - - 2 - - -'],
  futurebass:['2 . 3 . 4 - . 3 . 2 . 3 - - . .','4 . 3 . 4 . 5 - - . 4 . 3 - . .'],
  jazz:['. 2 3 4 - 3 2 . 1 - 0 - . . . .','4 - 3 . 2 1 . 2 - - 3 - . . . .'],
  hype:['0 . 0 . 3 . 0 . 2 . 0 . 1 . 0 .','3 . 3 . 2 . 2 . 1 . 1 . 0 - - -'],
  playful:['0 2 4 . 2 . 0 . 1 3 5 . 3 . 1 .','4 . 3 . 2 . 1 . 0 . 2 . 0 - . .'],
  dark:['0 - - - . . 1 - - . . . 0 - -1 -','2 - - - . . 1 - - - 0 - - - . .'],
  holiday:['0 - 2 - 4 - 3 2 1 - - - 2 - . .','4 - 3 - 2 - 1 0 1 - 2 - 0 - - -'],
  workout:['0 . 0 . 0 . 2 . 0 . 0 . 3 . 2 .','3 . 3 . 2 . 2 . 4 . 3 . 2 . 1 .'],
  piano:['2 - - 1 0 - - - 1 - 2 - 3 - - -','4 - 3 - 2 - - 1 - - 0 - - - . .'],
  guitar:['0 . 1 . 2 - 2 . 1 . 0 - . . 1 .','2 . 3 . 2 - 1 . 0 . 1 - - - . .'],
  bossa:['2 . . 3 . . 2 . 1 - . 0 . . . .','. 3 . . 4 . 3 . . 2 - - . . . .'],
  gospel:['0 - 1 2 - - 3 - 2 - - - 1 - 0 -','3 - 4 - 3 2 - - 1 - 2 - - - . .'],
  kids:['0 . 2 . 4 . 2 . 3 . 1 . 2 - . .','4 . 4 . 3 . 3 . 2 . 1 . 0 - . .'],
};
for(const k in MEL)if(MOODS[k])MOODS[k].mel=MEL[k].map(p=>p.split(' '));
const TONES={maj:[0,4,7],min:[0,3,7],min7:[0,3,7,10],maj7:[0,4,7,11],m9:[0,3,7,10,14],dom7:[0,4,7,10],add9:[0,4,7,14],sus2:[0,2,7],sus4:[0,5,7],pow:[0,7,12]};
const hz=m=>440*Math.pow(2,(m-69)/12);
async function makeBeat(seconds,moodKey){
  const M=MOODS[moodKey]||MOODS.bright,SR=44100,len=Math.max(1,seconds),oc=new OfflineAudioContext(2,Math.ceil((len+.05)*SR),SR);
  const step=60/M.bpm/4,master=oc.createGain(),comp=oc.createDynamicsCompressor();master.connect(comp);comp.connect(oc.destination);
  const vol=.55;master.gain.setValueAtTime(0,0);master.gain.linearRampToValueAtTime(vol,.3);master.gain.setValueAtTime(vol,Math.max(.31,len-1.8));master.gain.linearRampToValueAtTime(0,len);
  const noise=oc.createBuffer(1,SR,SR),nd=noise.getChannelData(0);for(let i=0;i<SR;i++)nd[i]=Math.random()*2-1;
  const out=(node,pan=0)=>{if(pan&&oc.createStereoPanner){let p=oc.createStereoPanner();p.pan.value=pan;node.connect(p);p.connect(master)}else node.connect(master)};
  const env=(g,t,peak,att,dec)=>{g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(0.0001,t+att+dec)};
  const kick=t=>{let o=oc.createOscillator(),g=oc.createGain(),d=M.boom?.7:.35;o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(M.boom?40:45,t+.12);env(g,t,.9,.003,d);o.connect(g);out(g);o.start(t);o.stop(t+d+.05)};
  const clap=t=>{for(let k=0;k<3;k++){let u=t+k*.011,s=oc.createBufferSource(),f=oc.createBiquadFilter(),g=oc.createGain();s.buffer=noise;f.type='bandpass';f.frequency.value=1500;f.Q.value=.9;env(g,u,k===2?.4:.22,.001,k===2?.16:.02);s.connect(f);f.connect(g);out(g);s.start(u,Math.random()*.5);s.stop(u+.2)}};
  const rim=t=>{let o=oc.createOscillator(),f=oc.createBiquadFilter(),g=oc.createGain();o.type='square';o.frequency.value=1700;f.type='highpass';f.frequency.value=900;env(g,t,.09,.001,.03);o.connect(f);f.connect(g);out(g,-.2);o.start(t);o.stop(t+.05)};
  const snare=t=>{let s=oc.createBufferSource(),f=oc.createBiquadFilter(),g=oc.createGain();s.buffer=noise;f.type='highpass';f.frequency.value=1300;env(g,t,.32,.002,.18);s.connect(f);f.connect(g);out(g);s.start(t,Math.random()*.5);s.stop(t+.22);
    let o=oc.createOscillator(),g2=oc.createGain();o.type='triangle';o.frequency.value=190;env(g2,t,.18,.002,.09);o.connect(g2);out(g2);o.start(t);o.stop(t+.12)};
  const hat=(t,open)=>{let s=oc.createBufferSource(),f=oc.createBiquadFilter(),g=oc.createGain();s.buffer=noise;f.type='highpass';f.frequency.value=7500;env(g,t,open?.09:.07,.001,open?.22:.045);s.connect(f);f.connect(g);out(g,.25);s.start(t,Math.random()*.5);s.stop(t+(open?.26:.06))};
  const bass=(t,m,d)=>{if(M.bass==='sub'){let o=oc.createOscillator(),g=oc.createGain();o.type='sine';o.frequency.setValueAtTime(hz(m+12),t);o.frequency.exponentialRampToValueAtTime(hz(m),t+.06);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.01);g.gain.setValueAtTime(.3,t+d*.6);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);out(g);o.start(t);o.stop(t+d+.02);return}
    let o=oc.createOscillator(),f=oc.createBiquadFilter(),g=oc.createGain();o.type=M.bass==='pluck'?'square':'sawtooth';o.frequency.value=hz(m);f.type='lowpass';f.frequency.value=M.bass==='pluck'?600:380;if(M.bass==='pluck')d=Math.min(d,.22);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(.28,t+.01);g.gain.setValueAtTime(.28,t+d*.7);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(f);f.connect(g);out(g);o.start(t);o.stop(t+d+.02)};
  const pad=(t,notes,d)=>{let f=oc.createBiquadFilter(),g=oc.createGain();f.type='lowpass';f.frequency.value=M.pad;g.gain.setValueAtTime(0.0001,t);const pv=.045*(M.padVol||1);g.gain.exponentialRampToValueAtTime(pv,t+.35);g.gain.setValueAtTime(pv,t+d-.3);g.gain.exponentialRampToValueAtTime(0.0001,t+d);f.connect(g);out(g);
    for(let m of notes)for(let det of [-7,7]){let o=oc.createOscillator();o.type=M.padType||'sawtooth';o.frequency.value=hz(m);o.detune.value=det;o.connect(f);o.start(t);o.stop(t+d+.05)}};
  // One note in the style's lead sound. amp scales it (the arpeggio plays softer under a tune); d = how long it's held.
  const strings=new Map(),string=(m,dur)=>{const k=m+':'+dur;if(strings.has(k))return strings.get(k);const n=Math.round(SR/hz(m)),len=Math.ceil(dur*SR),b=oc.createBuffer(1,len,SR),x=b.getChannelData(0),ring=new Float32Array(n);
    for(let i=0;i<n;i++)ring[i]=Math.random()*2-1;for(let i=0;i<len;i++){const j=i%n,v=ring[j];x[i]=v;ring[j]=.996*.5*(v+ring[(j+1)%n])}strings.set(k,b);return b};
  const pluck=(t,m,pan,amp=1,d=0)=>{if(M.lead==='bell'){for(const [r,v,dc] of [[1,.06,.5],[3.5,.018,.18]]){let o=oc.createOscillator(),g=oc.createGain(),dd=Math.max(dc,d*(r===1?1:.4));o.type='sine';o.frequency.value=hz(m)*r;env(g,t,v*amp,.002,dd);o.connect(g);out(g,pan);o.start(t);o.stop(t+dd+.05)}return}
    if(M.lead==='piano'){const dd=Math.min(2.2,.5+d*1.2);for(const [r,v] of [[1,.07],[2,.03],[3,.014],[4,.007]]){let o=oc.createOscillator(),g=oc.createGain();o.type='sine';o.frequency.value=hz(m)*r;o.detune.value=r*1.5;env(g,t,v*amp,.004,dd/r**.5);o.connect(g);out(g,pan);o.start(t);o.stop(t+dd+.05)}return}
    if(M.lead==='guitar'){const dd=Math.round(Math.min(2,.7+d)*10)/10,s=oc.createBufferSource(),f=oc.createBiquadFilter(),g=oc.createGain();s.buffer=string(m,dd);f.type='lowpass';f.frequency.value=3200;g.gain.value=.22*amp;s.connect(f);f.connect(g);out(g,pan);s.start(t);return}
    let o=oc.createOscillator(),g=oc.createGain();o.type=M.lead==='square'?'square':M.lead==='sine'?'sine':'triangle';if(M.lead==='square'){const dd=Math.max(.18,d);env(g,t,.035*amp,.004,dd);o.frequency.value=hz(m);o.connect(g);out(g,pan);o.start(t);o.stop(t+dd+.06);return}const dd=Math.max(.26,d);o.frequency.value=hz(m);env(g,t,.075*amp,.004,dd);o.connect(g);out(g,pan);o.start(t);o.stop(t+dd+.06)};
  const cb=M.chordBars||1,drums=M.drums!==false;
  for(let bar=0;bar*16*step<len;bar++){let t0=bar*16*step,[root,q]=M.chords[Math.floor(bar/cb)%M.chords.length],tones=TONES[q].map(x=>root+x);
    if(bar%cb===0)pad(t0,tones,16*step*cb);
    for(let s=0;s<16;s++){let t=t0+s*step+(M.swing&&s%2?M.swing*step*2:0);if(t>=len)break;
      if(drums){if(M.kick.includes(s))kick(t);if(M.snare.includes(s))snare(t);if(M.clap?.includes(s))clap(t);if(M.rim?.includes(s))rim(t);
        if(M.hats>0&&s%M.hats===0){if(M.roll?.includes(s))for(let k=0;k<3;k++)hat(t+k*step/3,false);else hat(t,false)}if(M.open?.includes(s))hat(t,true)}
      if(M.bass!=='none'){if(M.bassPat){if(M.bassPat.includes(s)){let nx=M.bassPat.find(x=>x>s)??16;bass(t,root-24+(s===14&&M.bass!=='sub'?7:0),step*(nx-s)*.95)}}
        else if(s%4===0||(s%4===3&&M.bpm>100))bass(t,root-24+(s===14?7:0),step*(s%4===0?2.6:.9))}
      if(s%M.arp===0&&(bar>0||!drums)){let k=(s/M.arp)%(tones.length+1);pluck(t,tones[k%tones.length]+12+(k>=tones.length?12:0),k%2?-.3:.3,M.mel?.45:1)}
      // The tune: from the second bar (the first is an intro), phrases A A B A.
      if(M.mel&&bar>0){const ph=M.mel[[0,0,1,0][bar%4]],tok=ph[s];if(tok!=null&&tok!=='.'&&tok!=='-'){let v=+tok,hold=1;while(ph[s+hold]==='-')hold++;const L=tones.length,note=tones[((v%L)+L)%L]+12*Math.floor(v/L)+12;pluck(t,note,0,1.15,hold*step)}}}}
  const buf=await oc.startRendering();return new File([wav(buf)],`TapShopLite beat · ${M.name} ${M.bpm} BPM.wav`,{type:'audio/wav'})}
function wav(buf){const ch=buf.numberOfChannels,n=buf.length,out=new DataView(new ArrayBuffer(44+n*ch*2)),w=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');out.setUint32(4,36+n*ch*2,true);w(8,'WAVE');w(12,'fmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,ch,true);out.setUint32(24,buf.sampleRate,true);out.setUint32(28,buf.sampleRate*ch*2,true);out.setUint16(32,ch*2,true);out.setUint16(34,16,true);w(36,'data');out.setUint32(40,n*ch*2,true);
  const data=[...Array(ch)].map((_,c)=>buf.getChannelData(c));let o=44;for(let i=0;i<n;i++)for(let c=0;c<ch;c++){let v=Math.max(-1,Math.min(1,data[c][i]));out.setInt16(o,v<0?v*0x8000:v*0x7fff,true);o+=2}
  return out.buffer}

// ---------- the AI that looks and listens (in a worker, so the page stays smooth) ----------
const WORKER=`let see=null,hear=null;
self.onmessage=async e=>{const m=e.data;try{
  const T=await import('${LIB}');T.env.allowLocalModels=false;
  const prog=p=>{if(p.status==='progress'&&p.total)self.postMessage({type:'dl',file:p.file,loaded:p.loaded,total:p.total})};
  if(m.task==='see'){
    if(!see)see=await T.pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{dtype:'q8',progress_callback:prog});
    const out=[];for(const img of m.images)out.push(await see(img,m.labels));self.postMessage({type:'done',id:m.id,result:out});
  }else{
    if(!hear){let err;for(const model of ['onnx-community/whisper-tiny_timestamped','Xenova/whisper-tiny']){try{hear=await T.pipeline('automatic-speech-recognition',model,{dtype:'q8',progress_callback:prog});break}catch(x){err=x}}if(!hear)throw err}
    const r=await hear(m.audio,{return_timestamps:true});self.postMessage({type:'done',id:m.id,result:{text:r.text||'',chunks:(r.chunks||[]).map(c=>({text:c.text,ts:c.timestamp}))}});
  }}catch(x){self.postMessage({type:'error',id:m.id,message:String(x&&x.message||x)})}};`;
let worker=null,askN=0;
function ask(msg,onDl,transfer){return new Promise((res,rej)=>{if(!worker)worker=new Worker(URL.createObjectURL(new Blob([WORKER],{type:'text/javascript'})),{type:'module'});
  const id=++askN;worker.onmessage=e=>{let m=e.data;if(m.type==='dl')onDl?.(m);else if(m.id!==id)return;else if(m.type==='done')res(m.result);else rej(Error(m.message))};
  worker.onerror=e=>rej(Error(e.message||'The clip reader could not start.'));worker.postMessage({...msg,id},transfer||[])})}
function stopWorker(){worker?.terminate();worker=null}

// Three small pictures from inside the clip (a separate <video>, so the editor's own players aren't moved).
async function frames(src){const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=src.asset.url;
  await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=()=>j(Error('Can’t read '+src.asset.name))});
  const out=[],len=src.out-src.in;for(const f of [.2,.5,.8]){await new Promise(r=>{let t=setTimeout(r,3000);v.onseeked=()=>{clearTimeout(t);r()};v.currentTime=src.in+len*f});
    let s=Math.min(1,320/Math.max(v.videoWidth||320,v.videoHeight||320)),c=document.createElement('canvas');c.width=Math.max(1,Math.round((v.videoWidth||320)*s));c.height=Math.max(1,Math.round((v.videoHeight||180)*s));
    c.getContext('2d').drawImage(v,0,0,c.width,c.height);out.push(c.toDataURL('image/jpeg',.82))}
  v.removeAttribute('src');v.load();return out}
// The clip's sound at 16 kHz mono, at most the first 28 seconds.
async function sound(src){let buf;try{buf=await new OfflineAudioContext(1,1,16000).decodeAudioData(await src.asset.file.arrayBuffer())}catch{return null}
  if(buf.sampleRate!==16000){let oc=new OfflineAudioContext(1,Math.ceil(buf.duration*16000),16000),s=oc.createBufferSource();s.buffer=buf;s.connect(oc.destination);s.start();buf=await oc.startRendering()}
  let a=Math.floor(src.in*16000),b=Math.min(buf.length,Math.ceil(Math.min(src.out,src.in+28)*16000)),mono=new Float32Array(Math.max(0,b-a));
  for(let ch=0;ch<buf.numberOfChannels;ch++){let d=buf.getChannelData(ch);for(let i=0;i<mono.length;i++)mono[i]+=d[a+i]/buf.numberOfChannels}
  let e=0;for(let i=0;i<mono.length;i+=8)e+=mono[i]*mono[i];return e/(mono.length/8||1)>1e-5?mono:null}

// ---------- matching clips to parts ----------
function scores(clip,tp){const n=tp.parts.length;return tp.parts.map((p,j)=>{let wsum=0,v=0;for(const [k,w] of Object.entries(p.look)){let i=LOOKS.findIndex(x=>x[0]===k);if(i<0)continue;v+=w*(clip.seen?.[i]||0);wsum+=w}
  let s=wsum?v/wsum*LOOKS.length/3:0;if(clip.words&&p.say.test(clip.words))s+=.35;if(clip.talking&&(p.id==='hook'||p.id==='cta'))s+=.12;
  // A small nudge towards the order the clips were added, so close calls keep the creator's order.
  s-=.12*Math.abs((clip.n/Math.max(1,clip.of-1))-(j/Math.max(1,n-1)));return s})}
function arrange(list,tp){const n=tp.parts.length,parts=tp.parts.map(()=>[]),sc=list.map(c=>scores(c,tp)),used=new Set(),filled=new Set();
  const pairs=[];sc.forEach((row,i)=>row.forEach((s,j)=>pairs.push([s,i,j])));pairs.sort((a,b)=>b[0]-a[0]);
  for(const [,i,j] of pairs){if(used.has(i)||filled.has(j))continue;parts[j].push(list[i]);used.add(i);filled.add(j);if(filled.size===n||used.size===list.length)break}
  list.forEach((c,i)=>{if(used.has(i))return;let j=sc[i].indexOf(Math.max(...sc[i]));parts[j].push(c)});
  parts.forEach(p=>p.sort((a,b)=>a.n-b.n));return parts}

// ---------- the dialog ----------
const dlg=document.createElement('dialog');dlg.id='brDialog';dlg.className='closable';document.body.appendChild(dlg);
const st=document.createElement('style');st.textContent=`
#brDialog{width:min(720px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}
#brDialog h3{margin:16px 0 6px;font-size:14px}
.br-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.br-tpl{text-align:left;padding:10px 12px!important;border-radius:12px!important;white-space:normal;line-height:1.3}
.br-tpl b{display:block;font-size:13px}.br-tpl small{display:block;font-size:11px;opacity:.7;margin-top:3px}.br-tpl .br-flow{display:block;font-size:10px;opacity:.6;margin-top:5px}
.br-tpl.on{outline:2px solid #ff3ea5;outline-offset:1px}
.br-add{display:flex;flex-wrap:wrap;gap:6px}
.br-clips{display:flex;gap:8px;overflow-x:auto;padding:8px 0 4px;min-height:24px}
.br-clip{position:relative;flex:none;width:112px;font-size:10px;line-height:1.25}
.br-clip img{display:block;width:112px;height:63px;object-fit:cover;border-radius:8px;background:#0003}
.br-clip .x{position:absolute;top:3px;right:3px;width:22px;height:22px;padding:0!important;border-radius:50%!important;font-size:13px;line-height:1;display:grid;place-items:center}
.br-clip .nm{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px;font-weight:600}
.br-clip .tag{display:block;opacity:.75;margin-top:2px}.br-clip .said{display:block;font-style:italic;opacity:.65;margin-top:2px;max-height:2.6em;overflow:hidden}
.br-clip select{width:100%;margin-top:4px;font-size:11px;padding:3px 4px}
.br-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.br-caps{display:flex;gap:10px;align-items:flex-start;margin:12px 0 4px;padding:10px 12px;border:1px solid var(--ts-border,#8a7aa855);border-radius:12px;cursor:pointer}.br-caps input{width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:#ff3ea5}.br-caps b{display:block;font-size:13px}.br-caps small{display:block;font-size:12px;opacity:.75;margin-top:2px}#brListen{grid-column:1/-1;justify-self:end}.br-row label{display:flex;flex-direction:column;gap:4px;font-size:12px}
.br-sec{border:1px solid var(--ts-border,#8883);border-radius:12px;padding:10px;margin:8px 0}
.br-sec-h{display:flex;align-items:center;gap:8px}.br-sec-h b{font-size:13px;white-space:nowrap}.br-sec-h input{flex:1;min-width:0;font-size:13px;padding:6px 8px}
.br-sec .br-empty{font-size:11px;opacity:.6;padding:6px 0}
#brWork progress{width:100%}`;document.head.appendChild(st);

let tp=TEMPLATES[0],mood='auto',shape='9:16',items=[],parts=null,texts={},busy=false,stopped=false,autoStory=true,picked='';
// Auto captions (✨ Captions without its dialog) after building, remembered on this device; on unless turned off.
let autoCaps=(()=>{try{return localStorage.getItem('tapshop-broll-captions')!=='off'}catch{return true}})();
// Tidy talking clips: cut pauses over half a second and um/uh, using the captions engine's word times. On unless turned off.
let autoTidy=(()=>{try{return localStorage.getItem('tapshop-broll-tidy')!=='off'}catch{return true}})();
// Movement: zooms, pans, cut effects and small bumps on the beat (clip motion/intro/pulse in video.js). On unless turned off.
// Cloud AI (Groq, see video-captions.js veCloudWords): more accurate words, keeps "um"s so they can be cut, and finds
// fumbles and retakes. Only offered when config.js switches it on; falls back to the on-device AI on any problem.
// Clean sound (video-cleansound.js): fan/AC noise out, record start/stop clicks muted. On unless turned off.
let autoClean=(()=>{try{return localStorage.getItem('tapshop-broll-clean')!=='off'}catch{return true}})();
let autoCloud=(()=>{try{return localStorage.getItem('tapshop-broll-cloud')!=='off'}catch{return true}})();
let autoMove=(()=>{try{return localStorage.getItem('tapshop-broll-motion')!=='off'}catch{return true}})();
const shapes=()=>[...($$('aspect')?.options||[])].map(o=>[o.value,o.textContent]);
// From the start screen the chosen platform has already set the shape; otherwise UGC defaults to vertical.
function open(fromStart){if(exporting)return;stopped=false;parts=null;let a=$$('aspect')?.value;shape=(fromStart===true||clips.length)&&['9:16','1:1','4:5','16:9'].includes(a)?a:'9:16';if(!items.length&&clips.length)useTimeline(true);step1();dlg.showModal()}
function close(){stopped=true;if(busy)stopWorker();busy=false;dlg.close()}
dlg.addEventListener('cancel',e=>{e.preventDefault();close()});

function step1(){const flow=t=>t.parts.map(p=>p.label).join(' → ');
  dlg.innerHTML=`<button type="button" class="dialog-x" aria-label="Close" title="Close">×</button><h2>🎞️ B-roll Video Maker</h2>
  <p class="sub">Add your clips and we do the rest: we watch and listen to each clip, pick the story and music, use the best moment of each clip, write words on screen from what you say, and cut it all to the beat with movement.</p>
  <h3>1. Pick a story</h3><div class="br-tpls"><button type="button" class="br-tpl br-auto${autoStory?' on':''}" data-t="auto"><b>✨ Pick for me</b><small>We look at your clips and choose the best story</small><span class="br-flow">Works best with ✨ Sort my clips</span></button>${TEMPLATES.map(t=>`<button type="button" class="br-tpl${!autoStory&&t===tp?' on':''}" data-t="${t.id}"><b>${enc(t.name)}</b><small>${enc(t.tag)}</small><span class="br-flow">${enc(flow(t))}</span></button>`).join('')}</div>
  <h3>2. Add your clips <small class="sub">(${items.length})</small></h3>
  <div class="br-add"><button type="button" class="primary" id="brChoose">📹 Choose clips</button>${typeof VaultPicker!=='undefined'&&VaultPicker.inTapShop?'<button type="button" id="brVault">⛁ From Media Vault</button>':''}${clips.length?`<button type="button" id="brTimeline">🎬 Use my timeline clips (${clips.length})</button>`:''}<input type="file" id="brFiles" accept="video/*" multiple hidden></div>
  <div class="br-clips">${items.length?items.map((c,i)=>`<div class="br-clip"><img alt="" src="${c.asset.thumb}"><button type="button" class="x" data-x="${i}" aria-label="Remove ${enc(c.asset.name)}">×</button><span class="nm">${enc(c.asset.name)}</span><span class="tag">${(c.out-c.in).toFixed(1)}s</span></div>`).join(''):'<p class="sub" style="margin:0">No clips yet. Add 3 or more for the best result.</p>'}</div>
  <h3>3. Look and sound</h3><div class="br-row"><label>Video shape<select id="brShape">${shapes().map(([v,l])=>`<option value="${enc(v)}"${v===shape?' selected':''}>${enc(l)}</option>`).join('')}</select></label>
  <label>Music<select id="brMood"><option value="auto"${mood==='auto'?' selected':''}>✨ Pick for me</option>${Object.entries(MOODS).map(([k,m])=>`<option value="${k}"${k===mood?' selected':''}>🎵 ${enc(m.name)} · ${m.bpm} BPM</option>`).join('')}<option value=""${mood?'':' selected'}>No music</option></select></label><button type="button" id="brListen" title="Hear a few seconds of this music">▶ Listen</button></div>
  <label class="br-caps"><input type="checkbox" id="brCaps"${autoCaps?' checked':''}> <span><b>✨ Add captions when someone talks</b><small>We write the words people say on screen, like the ✨ Captions tool.</small></span></label>
  <label class="br-caps"><input type="checkbox" id="brTidy"${autoTidy?' checked':''}> <span><b>✂️ Cut pauses and “um”s</b><small>We remove long pauses and “um” / “uh” from talking clips, so they flow.</small></span></label>
  <label class="br-caps"><input type="checkbox" id="brClean"${autoClean?' checked':''}> <span><b>🔇 Clean up the sound</b><small>We take out steady background noise like a fan or AC, and the click when you start and stop recording.</small></span></label>
  ${window.veCloudOn?.()?`<label class="br-caps"><input type="checkbox" id="brCloud"${autoCloud?' checked':''}> <span><b>☁️ Use cloud AI (more accurate)</b><small>Better captions, and it also cuts fumbles and retakes. The sound of your talking clips is sent to Groq’s AI to be written down. Turn off to keep everything on this device.</small></span></label>`:''}
  <label class="br-caps"><input type="checkbox" id="brMove"${autoMove?' checked':''}> <span><b>🎬 Add slow, smooth zooms</b><small>A slow, gentle zoom on each clip so still shots feel alive. Cuts still land on the beat.</small></span></label>
  <p class="sub">The first time, your browser downloads the clip reader (a one-time download, about 130 MB). After that it’s saved. Phones are slower than computers.</p>
  <div class="row"><button type="button" id="brCancel">Cancel</button><button type="button" id="brSkip"${items.length?'':' disabled'}>Keep my order</button><button type="button" class="primary" id="brGo"${items.length?'':' disabled'}>✨ Sort my clips</button></div>`;
  dlg.querySelector('.dialog-x').onclick=dlg.querySelector('#brCancel').onclick=close;
  dlg.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{if(b.dataset.t==='auto')autoStory=true;else{autoStory=false;tp=TEMPLATES.find(t=>t.id===b.dataset.t);if(mood!=='auto')mood=tp.mood}step1()});
  dlg.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{items.splice(+b.dataset.x,1);step1()});
  const fi=dlg.querySelector('#brFiles');dlg.querySelector('#brChoose').onclick=()=>fi.click();fi.onchange=()=>{addFiles([...fi.files]);fi.value=''};
  dlg.querySelector('#brVault')?.addEventListener('click',()=>VaultPicker.open({title:'Pick a clip',kinds:['video'],onPick:async it=>{try{toast('Loading '+it.name+'…');await addFiles([await VaultPicker.file(it)])}catch(e){toast(e.message)}if(!dlg.open)dlg.showModal()}}));
  dlg.querySelector('#brTimeline')?.addEventListener('click',()=>{useTimeline();step1()});
  dlg.querySelector('#brShape').onchange=e=>shape=e.target.value;dlg.querySelector('#brMood').onchange=e=>{mood=e.target.value;stopListen()};dlg.querySelector('#brListen').onclick=listen;dlg.querySelector('#brCaps').onchange=e=>{autoCaps=e.target.checked;try{localStorage.setItem('tapshop-broll-captions',autoCaps?'on':'off')}catch{}};dlg.querySelector('#brTidy').onchange=e=>{autoTidy=e.target.checked;try{localStorage.setItem('tapshop-broll-tidy',autoTidy?'on':'off')}catch{}};dlg.querySelector('#brClean').onchange=e=>{autoClean=e.target.checked;try{localStorage.setItem('tapshop-broll-clean',autoClean?'on':'off')}catch{}};dlg.querySelector('#brCloud')&&(dlg.querySelector('#brCloud').onchange=e=>{autoCloud=e.target.checked;try{localStorage.setItem('tapshop-broll-cloud',autoCloud?'on':'off')}catch{}});dlg.querySelector('#brMove').onchange=e=>{autoMove=e.target.checked;try{localStorage.setItem('tapshop-broll-motion',autoMove?'on':'off')}catch{}};if(!dlg._stopsMusic){dlg._stopsMusic=1;dlg.addEventListener('close',stopListen)}
  dlg.querySelector('#brGo').onclick=analyse;dlg.querySelector('#brSkip').onclick=()=>{number();choose(false);step3('Kept your order.'+pickedNote()+' Move any clip with the menu under it.')}}
async function addFiles(files){let got=0;for(const f of files){if(!/^video\//.test(f.type)&&!/\.(mp4|mov|webm|m4v)$/i.test(f.name))continue;try{toast('Loading '+f.name+'…');let a=await loadAsset(f);items.push({asset:a,in:0,out:a.duration});got++}catch(e){toast(e.message)}}if(got&&dlg.open)step1()}
function useTimeline(quiet){let seen=new Set(items.map(c=>c.key));for(const c of clips){let a=asset(c);if(!a)continue;let key=c.id;if(seen.has(key))continue;items.push({asset:a,in:c.in,out:c.out,key})}if(!quiet)toast('Your timeline clips are in.')}
const number=()=>items.forEach((c,i)=>{c.n=i;c.of=items.length});

async function analyse(){number();busy=true;stopped=false;
  dlg.innerHTML=`<h2>✨ Sorting your clips…</h2><p class="sub">We’re watching and listening to each clip. Nothing is uploaded; it all happens on this device.</p>
  <div id="brWork"><progress id="brProg" max="1" value="0"></progress><p class="sub" id="brStatus" aria-live="polite">Getting ready…</p></div>
  <div class="row"><button type="button" id="brStop">Cancel</button><button type="button" id="brKeep">Skip, keep my order</button></div>`;
  const status=s=>{let el=$$('brStatus');if(el)el.textContent=s},prog=v=>{let el=$$('brProg');if(el)el.value=v};
  const dl=m=>status(`Downloading the clip reader (one time only)… ${Math.round(m.loaded/1e6)} of ${Math.round(m.total/1e6)} MB`);
  dlg.querySelector('#brStop').onclick=()=>{stopped=true;stopWorker();busy=false;step1()};
  dlg.querySelector('#brKeep').onclick=()=>{stopped=true;stopWorker();busy=false;choose(false);step3('Kept your order.'+pickedNote()+' Move any clip with the menu under it.')};
  let failed=null;const labels=LOOKS.map(x=>x[1]);
  try{for(let i=0;i<items.length;i++){if(stopped)return;let c=items[i];
      status(`Watching clip ${i+1} of ${items.length}: ${c.asset.name}`);prog(i/items.length);
      let res=await ask({task:'see',images:await frames(c),labels},dl);if(stopped)return;
      c.seen=LOOKS.map(([,p])=>res.reduce((n,r)=>n+(r.find(x=>x.label===p)?.score||0),0)/res.length);
      status(`Listening to clip ${i+1} of ${items.length}…`);prog((i+.5)/items.length);
      let audio=await sound(c);if(stopped)return;
      if(audio){let r=await ask({task:'hear',audio},dl,[audio.buffer]);if(stopped)return;let text=String(r.text||'').trim(),ts=r.chunks.map(x=>x.ts).filter(t=>t&&Number.isFinite(t[0]));
        c.words=text;c.talking=text.split(/\s+/).filter(w=>/[a-z]/i.test(w)).length>=4;if(ts.length){c.speech=[ts[0][0],Math.max(...ts.map(t=>Number.isFinite(t[1])?t[1]:t[0]+1))]}}
      prog((i+1)/items.length)}}
  catch(x){failed=x}
  busy=false;if(stopped)return;
  choose(!failed);
  step3(failed?'We couldn’t run the clip reader ('+(failed.message||failed)+'). Check your internet connection for the first download. Your clips are in your order; move any clip with the menu under it.':'Here’s where we think each clip fits.'+pickedNote()+' Not right? Move a clip with the menu under it.')}

// ---------- picking the story and the music ----------
// The story whose parts best fit the clips (picture + words), with a pull towards using every part and not
// having more parts than clips. Without the clip reader we go by how many clips there are.
function bestStory(){let best=null,top=-1e9;for(const T of TEMPLATES){const P=arrange(items,T);let fit=0,said=0;
    P.forEach((list,j)=>list.forEach(c=>{fit+=scores(c,T)[j];if(c.words&&T.parts[j].say.test(c.words))said++}));
    const filled=P.filter(x=>x.length).length/T.parts.length,sc=fit/items.length+.6*filled+.08*said-.15*Math.max(0,T.parts.length-items.length);
    if(sc>top){top=sc;best=T}}return best}
const BY_COUNT={2:'beforeafter',3:'pas',4:'pas',5:'reasons'};
// Music that suits what the clips mostly show; talky videos get calmer beats so the voice stays clear.
const LOOK_MOOD={talk:'chill',product:'upbeat',unbox:'futurebass',messy:'funk',clean:'bright',using:'acoustic',happy:'playful',upset:'dark',screen:'synthwave',food:'jazz',beauty:'rnb',outside:'tropical'};
function bestMood(){const seen=items.filter(c=>c.seen);if(!seen.length)return tp.mood;
  const sum=LOOKS.map((_,i)=>seen.reduce((n,c)=>n+c.seen[i],0)),talky=items.filter(c=>c.talking).length/items.length;
  const order=sum.map((v,i)=>[v,LOOKS[i][0]]).sort((a,b)=>b[0]-a[0]);let key=order[0][1];if(key==='talk')key=order[1][1];
  let m=LOOK_MOOD[key]||tp.mood;if(talky>=.5&&MOODS[m]&&MOODS[m].bpm>=125)m='chill';return m}
function choose(read){picked='';number();
  if(autoStory){tp=read?bestStory():TEMPLATES.find(t=>t.id===BY_COUNT[items.length])||TEMPLATES[0];picked='story'}
  parts=arrange(items,tp);if(mood==='auto'){mood=read?bestMood():tp.mood;picked+=' music'}}
const pickedNote=()=>{let a=[];if(/story/.test(picked))a.push(`the “${tp.name}” story`);if(/music/.test(picked)&&MOODS[mood])a.push(`${MOODS[mood].name} music`);return a.length?` We picked ${a.join(' and ')} for you.`:''};

// ---------- words on screen from what was said ----------
// A part's words come from what its talking clips say: a sentence with the part's usual words (any sentence
// for the hook, preferring a question or exclamation), with opening fillers removed, kept short, plus the
// template's emoji. Typed words always win; parts with no talking keep the template's words.
const sentences=t=>String(t||'').replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.split(' ').length>=2);
const LEAD=/^((um+|uh+|so|okay|ok|well|like|and|but|yeah|hey|alright|you guys|guys)[,.!]?\s+)+/i;
function shorten(x,max=42){x=x.replace(LEAD,'').replace(/\b(um+|uh+)[,.]?\s*/gi,'').replace(/[.]+$/,'').trim();if(!x)return '';x=x[0].toUpperCase()+x.slice(1);
  if(x.length<=max)return x;let c=x.slice(0,max);c=c.slice(0,Math.max(c.lastIndexOf(' '),20)).replace(/[,;:\-–]+$/,'');return c+'…'}
function suggest(j){const p=tp.parts[j],talk=(parts?.[j]||[]).filter(c=>c.talking&&c.words);if(!talk.length)return null;const ss=talk.flatMap(c=>sentences(c.words));if(!ss.length)return null;
  const pick=ss.find(x=>p.say.test(x))||(p.id==='hook'?(ss.find(x=>/[?!]/.test(x))||ss[0]):null);if(!pick)return null;const t=shorten(pick);if(!t)return null;
  const emo=(p.text.match(/(\p{Extended_Pictographic}\uFE0F?)\s*$/u)||[])[1];return t+(emo?' '+emo:'')}
const partText=j=>{const p=tp.parts[j],k=tp.id+p.id;return texts[k]??suggest(j)??p.text};

function step3(note){const opts=j=>tp.parts.map((p,k)=>`<option value="${k}"${k===j?' selected':''}>Move to: ${enc(p.label)}</option>`).join('');
  const tag=c=>{if(!c.seen)return '';let i=c.seen.indexOf(Math.max(...c.seen));return enc(LOOKS[i][2])+(c.talking&&LOOKS[i][0]!=='talk'?' · 🗣':'')};
  dlg.innerHTML=`<button type="button" class="dialog-x" aria-label="Close" title="Close">×</button><h2>🎞️ ${enc(tp.name)}</h2><p class="sub">${enc(note)}</p>
  ${tp.parts.some((p,j)=>texts[tp.id+p.id]==null&&suggest(j))?'<p class="sub">✍️ Some words on screen were written from what you said. Change them any time.</p>':''}
  <div class="br-row" style="margin-bottom:6px"><label>Music<select id="brMood3">${Object.entries(MOODS).map(([k,m])=>`<option value="${k}"${k===mood?' selected':''}>🎵 ${enc(m.name)} · ${m.bpm} BPM</option>`).join('')}<option value=""${mood?'':' selected'}>No music</option></select></label></div>
  ${tp.parts.map((p,j)=>`<div class="br-sec"><div class="br-sec-h"><b>${j+1}. ${enc(p.label)}</b><input type="text" data-tx="${p.id}" value="${enc(partText(j))}" aria-label="Words on screen for ${enc(p.label)}" placeholder="Words on screen (leave empty for none)"></div>
    <div class="br-clips">${parts[j].length?parts[j].map(c=>`<div class="br-clip"><img alt="" src="${c.asset.thumb}"><span class="nm">${enc(c.asset.name)}</span><span class="tag">${tag(c)}</span>${c.words?`<span class="said">“${enc(c.words.slice(0,70))}${c.words.length>70?'…':''}”</span>`:''}<select data-mv="${c.n}" aria-label="Move ${enc(c.asset.name)}">${opts(j)}</select></div>`).join(''):'<p class="br-empty">No clip here. This part will be skipped.</p>'}</div></div>`).join('')}
  <div class="row"><button type="button" id="brBack">← Back</button><button type="button" class="primary" id="brBuild">🎬 Build my video</button></div>`;
  dlg.querySelector('.dialog-x').onclick=close;dlg.querySelector('#brBack').onclick=step1;
  dlg.querySelectorAll('[data-tx]').forEach(el=>el.oninput=()=>texts[tp.id+el.dataset.tx]=el.value);
  dlg.querySelectorAll('[data-mv]').forEach(sel=>sel.onchange=()=>{let c=items.find(x=>x.n===+sel.dataset.mv);parts.forEach(p=>{let k=p.indexOf(c);if(k>=0)p.splice(k,1)});parts[+sel.value].push(c);parts[+sel.value].sort((a,b)=>a.n-b.n);step3(note)});
  dlg.querySelector('#brMood3').onchange=e=>{mood=e.target.value};dlg.querySelector('#brBuild').onclick=build}

// ---------- the best moments ----------
// Up to 16 tiny frames across a clip: sharpness (edges), brightness, and how much the picture jumps between
// frames (shake or fast pans). c.q = [{t, s}], higher s = a nicer moment to show.
async function scan(c){const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=c.asset.url;
  try{await new Promise((r,j)=>{let t=setTimeout(()=>j(Error('timeout')),8000);v.onloadeddata=()=>{clearTimeout(t);r()};v.onerror=()=>{clearTimeout(t);j(Error('read'))}});
    const len=c.out-c.in,N=Math.max(4,Math.min(16,Math.round(len/.5))),W=64,H=Math.max(16,Math.round(64*(v.videoHeight||9)/(v.videoWidth||16))),cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const g=cv.getContext('2d',{willReadFrequently:true}),raw=[];let prev=null;
    for(let i=0;i<N;i++){const t=c.in+len*(i+.5)/N;await new Promise(r=>{let to=setTimeout(r,2500);v.onseeked=()=>{clearTimeout(to);r()};v.currentTime=t});
      g.drawImage(v,0,0,W,H);const d=g.getImageData(0,0,W,H).data,y=new Float32Array(W*H);let mean=0;for(let k=0;k<W*H;k++){y[k]=.299*d[k*4]+.587*d[k*4+1]+.114*d[k*4+2];mean+=y[k]}mean/=W*H;
      let sharp=0;for(let yy=1;yy<H-1;yy++)for(let xx=1;xx<W-1;xx++){const k=yy*W+xx;sharp+=Math.abs(4*y[k]-y[k-1]-y[k+1]-y[k-W]-y[k+W])}sharp/=(W-2)*(H-2);
      let jump=0;if(prev){for(let k=0;k<W*H;k++)jump+=Math.abs(y[k]-prev[k]);jump/=W*H}prev=y;raw.push({t,mean,sharp,jump})}
    const top=Math.max(1,...raw.map(r=>r.sharp));
    c.q=raw.map(r=>({t:r.t,s:r.sharp/top-(r.mean<45?(45-r.mean)/45:0)-(r.mean>235?.5:0)-Math.max(0,r.jump-20)/40}))}
  catch{c.q=null}finally{v.removeAttribute('src');v.load()}}
// The stretch of length L in [a, b] whose frames score best (start time).
function bestStart(c,a,b,L){if(!c.q?.length||b-a<=L+.05)return null;let best=a,top=-1e9;
  for(let x=a;x+L<=b+1e-6;x+=.1){const inn=c.q.filter(q=>q.t>=x&&q.t<=x+L);if(!inn.length)continue;const sc=inn.reduce((n,q)=>n+q.s,0)/inn.length;if(sc>top+1e-6){top=sc;best=x}}return best}

// ---------- building the video ----------
// Talking clips keep everything that's said; other clips are cut to whole beats so cuts land on the music.
function cut(c,part,beat){let a=c.in,b=c.out;
  if(c.talking&&c.speech){a=Math.max(c.in,c.in+c.speech[0]-.15);b=Math.min(c.out,c.in+c.speech[1]+.35);if(b-a<.5){a=c.in;b=c.out}return [a,b]}
  if(!beat){const L=Math.min(6,b-a),x=bestStart(c,a,b,L);return x==null?[a,a+L]:[x,x+L]}let n=Math.min(part.beats||6,Math.floor((b-a)/beat));if(n<2)return [a,b];
  const L=n*beat,x=bestStart(c,a,b,L);if(x!=null)return [x,x+L];let start=Math.min(a+.2,b-L);return [Math.max(a,start),Math.max(a,start)+L]}
const textFrac=(s,W,H)=>{let f=.055,px=f*H,w=s.length*.6*px;return w>W*.84?W*.84/(s.length*.6)/H:f};
async function build(){if(exporting)return;const btn=dlg.querySelector('#brBuild');btn.disabled=true;btn.textContent='Building…';
  try{if(mood==='auto')mood=tp.mood;const used=parts.flat().map(c=>c.asset),M=MOODS[mood],beat=M?60/M.bpm:0,heard=parts.flat().some(c=>c.words!==undefined);
    // Find each non-talking clip's best moment before cutting it.
    const look=parts.flat().filter(c=>!c.talking&&!c.q);for(let i=0;i<look.length;i++){btn.textContent=`Finding the best moments (${i+1} of ${look.length})…`;await scan(look[i])}
    if(clips.length||graphicTracks.length||extraTracks.length){if(window.veNewProject)await veNewProject();else{clips=[];graphicTracks=[]}}
    for(const a of used)if(!assets.includes(a))assets.push(a);
    if(autoClean&&window.veCleanSound){const list=[...new Set(used)];for(let i=0;i<list.length;i++){btn.textContent=`Cleaning up the sound (${i+1} of ${list.length})…`;try{await veCleanSound(list[i],p=>btn.textContent=`Cleaning up the sound (${i+1} of ${list.length})… ${p}%`)}catch(e){console.warn('Sound clean-up skipped:',e)}}}
    $$('aspect').value=shape;setAspect();const W=canvas.width,H=canvas.height;
    // Listen to clips that talk (or all of them after Keep my order) for captions and tidying.
    const listen=(autoCaps||autoTidy)&&typeof window.veClipWords==='function',todo=parts.flat().filter(c=>c.talking||!heard);
    // Cloud AI first: all talking clips in one go. Any problem (off, daily limit, no internet) → on-device AI below.
    let cloud=null,cloudNote='';
    if(listen&&autoCloud&&todo.length&&window.veCloudOn?.()){btn.textContent='Cloud AI is listening…';
      try{const r=await veCloudWords(todo.map(c=>({assetId:c.asset.id,in:c.in,out:c.out})),m=>btn.textContent=m);cloud=new Map(todo.map((c,i)=>[c,r.words[i]]));if(r.left!=null)cloudNote=` Cloud AI videos left today: ${r.left}.`}
      catch(e){console.warn('Cloud AI skipped:',e);cloudNote=e.code==='limit'?' '+e.message+' We used the on-device AI instead.':e.code==='off'?'':' The cloud AI wasn’t available, so we used the on-device AI.'}}
    let t=0,talky=false,failed=false,listened=false,n=0,moveN=0,skipped=0;const spans=[],capWords=[];
    for(let j=0;j<tp.parts.length;j++){const p=tp.parts[j];if(!parts[j].length)continue;let s=t;
      for(const c of parts[j]){let [a,b]=cut(c,p,beat),segs=[[a,b]],words=null;
        if(listen&&!failed&&todo.includes(c)){btn.textContent=`Listening to clip ${++n} of ${todo.length}…`;
          try{words=cloud?.get(c)||await veClipWords({assetId:c.asset.id,in:c.in,out:c.out},m=>btn.textContent=m);listened=true;
            if(words.length>=4){talky=true;a=Math.max(c.in,words[0].s-.15);b=Math.min(c.out,words.at(-1).e+.35);segs=[[a,b]]}
            if(autoTidy&&words.length&&!words.est)segs=tidy(words,a,b)}
          catch(e){failed=true;console.warn('Speech engine unavailable:',e)}}
        // A throwaway take (only "um", "ok", "alright"… or words the cloud AI marked as a mistake) is left out
        // completely, as long as the video still has other clips.
        if(autoTidy&&words?.length&&!words.est&&words.every(junk)&&parts.flat().length>1){skipped++;continue}
        if(c.talking)talky=true;
        segs.forEach(([x,y],si)=>{let cl=makeClip(c.asset);Object.assign(cl,{in:x,out:y,fit:shape==='16:9'?'contain':'cover'});
          if(autoMove){const speaking=(words&&words.length>=4)||c.talking;
            // Calm: one very slow zoom per clip, in then out on the next. Talking jump cuts switch to a slight close-up so they look on purpose.
            cl.motion=speaking?(segs.length>1&&si%2?'closeSoft':''):(moveN++%2?'slowOut':'slowIn')}
          clips.push(cl);
          if(words)for(const w of words)if(w.e>x&&w.s<y&&!(autoTidy&&!words.est&&(w.drop||FILLER.test(String(w.w).replace(/[^a-z]/gi,'')))))capWords.push({w:w.w,s:Math.round((t+Math.max(0,w.s-x))*100)/100,e:Math.round((t+Math.min(y,w.e)-x)*100)/100});
          t+=y-x})}
      if(t>s)spans.push([p,s,t-s,j])}
    btn.textContent='Building…';
    for(const [p,s,len,j] of spans){let text=String(partText(j)).trim();if(!text)continue;createGraphicTrack('text');let g=graphicTracks.at(-1);
      Object.assign(g,{name:p.label+': '+text.slice(0,18),text,color:p.color||'#ffffff',size:textFrac(text,W,H)*H*1280/W,x:50,y:p.y,bold:true,background:false,animation:p.anim,offset:Math.round(s*10)/10,length:Math.max(.8,Math.round(Math.min(len,p.textMax||len)*10)/10),boxColor:p.box,boxOpacity:1,boxPad:26,boxRadius:18})}
    if(M&&t>0){btn.textContent='Making your music…';let file=await makeBeat(t,mood);addTrack('audio');let tr=extraTracks.at(-1);tr.name='🎵 '+M.name+' beat';targetTrack=tr.id;await loadTrackMedia(file);tr.volume=talky?.22:.7;renderTracks()}
    for(const c of clips)if(asset(c)?.cleanFile)c.clean=true;
    $$('projectName').value='B-roll · '+tp.name;selected=-1;render();renderTracks();renderGraphicTracks();await seekTimeline(0);
    items=[];parts=null;dlg.close();
    let capped=autoCaps&&!failed?vePlaceCaptions(capWords):0;
    toast((failed?'Your video is ready! Captions and pause-cutting didn’t work here, but you can try ✨ Captions in the toolbar.':capped?`Your video is ready, with captions (${capped} words)! Press ▶ to watch it.`:autoCaps&&listened?'Your video is ready! We didn’t hear any talking, so there are no captions. Press ▶ to watch it.':'Your video is ready! Press ▶ to watch it.')+(skipped?` We left out ${skipped} clip${skipped>1?'s':''} with only “um”, “ok” or a fumble.`:'')+cloudNote)}
  catch(e){toast('Couldn’t build the video: '+(e.message||e));btn.disabled=false;btn.textContent='🎬 Build my video'}}

// Split a talking stretch [a, b] into the parts worth keeping: drop um/uh, fumbles the cloud AI marked (w.drop) and pauses over half a second,
// leaving a little air around each word so cuts don't clip them.
const FILLER=/^(u+m+|u+h+|uhm+|e+r+m*|a+h+|h+m+|m+h*m+)$/i;
// Words that mean nothing on their own: a clip with only these (and fillers) is a throwaway take.
const EMPTY=/^(ok(ay)?|k|alright|all|right|so|yeah|yep|yes|cool|and|well|mhm|uh-?huh|go|action|cut|again|one|more|time|sorry|wait|hold|on)$/i;
const junk=w=>{const k=String(w.w).toLowerCase().replace(/[^a-z-]/g,'');return w.drop||!k||FILLER.test(k)||EMPTY.test(k)};
function tidy(words,a,b){const ws=words.filter(w=>w.e>a&&w.s<b),isF=w=>w.drop||FILLER.test(String(w.w).replace(/[^a-z]/gi,'')),kept=ws.filter(w=>!isF(w));
  if(!kept.length)return [[a,b]];const out=[];let start=Math.max(a,kept[0].s-.12);
  for(let i=0;i<kept.length-1;i++){const cur=kept[i],nx=kept[i+1],gap=nx.s-cur.e,ums=ws.filter(w=>isF(w)&&w.s>=cur.e-.05&&w.e<=nx.s+.05);
    if(gap>.5||(ums.length&&gap>.2)){const end=Math.min(nx.s,cur.e+.12,ums.length?ums[0].s:Infinity);out.push([start,end]);start=Math.max(end,nx.s-.1,ums.length?ums.at(-1).e:-Infinity)}}
  out.push([start,Math.min(b,kept.at(-1).e+.3)]);const good=out.filter(([x,y])=>y-x>.15);return good.length?good:[[a,b]]}

// ---------- ways in ----------
window.openBroll=open;window.veMakeBeat=makeBeat;
// Free music for any audio track: pick a style, hear 10 seconds, then it's made as long as the video
// (at least 15 s, at most 5 minutes) and put on that track.
window.openFreeMusic=function(trackId){if(exporting)return;pause();let d=$$('fmDialog');
  if(!d){d=document.createElement('dialog');d.id='fmDialog';d.className='closable';document.body.appendChild(d);d.addEventListener('close',()=>{fmAudio?.pause();fmAudio=null})}
  const len=Math.min(300,Math.max(15,Math.ceil(total()||0)));
  d.innerHTML=`<button type="button" class="dialog-x" aria-label="Close" title="Close">×</button><h2>🎵 Free music</h2><p class="sub">Made on your device, free to use anywhere. Press ▶ to hear a style, then <b>Use</b> to put it on this track (${len} seconds${total()>=15&&total()<=300?', the length of your video':''}).</p>
  <div class="fm-list">${Object.entries(MOODS).map(([k,m])=>`<div class="fm-row"><button type="button" class="fm-play" data-p="${k}" aria-label="Listen to ${enc(m.name)}">▶</button><span><b>${enc(m.name)}</b><small>${m.bpm} BPM</small></span><button type="button" class="primary" data-u="${k}">Use</button></div>`).join('')}</div>
  <p class="sub" id="fmStatus" aria-live="polite"></p>`;
  const say=s=>d.querySelector('#fmStatus').textContent=s;
  d.querySelector('.dialog-x').onclick=()=>d.close();
  d.querySelectorAll('[data-p]').forEach(b=>b.onclick=async()=>{const was=b.textContent==='■';fmAudio?.pause();fmAudio=null;d.querySelectorAll('[data-p]').forEach(x=>x.textContent='▶');if(was)return;
    b.textContent='…';try{const a=new Audio(URL.createObjectURL(await makeBeat(10,b.dataset.p)));fmAudio=a;a.onended=()=>b.textContent='▶';await a.play();b.textContent='■'}catch{b.textContent='▶';say('Couldn’t play it here.')}});
  d.querySelectorAll('[data-u]').forEach(b=>b.onclick=async()=>{const k=b.dataset.u;fmAudio?.pause();d.querySelectorAll('button').forEach(x=>x.disabled=true);say(`Making your ${MOODS[k].name} music…`);
    try{const f=await makeBeat(len,k);targetTrack=trackId;await loadTrackMedia(f);const t=extraTracks.find(x=>x.id===trackId);if(t)t.name='🎵 '+MOODS[k].name+' beat';renderTracks();d.close();toast(`${MOODS[k].name} music added.`)}
    catch(e){say('Couldn’t make the music: '+(e.message||e))}finally{d.querySelectorAll('button').forEach(x=>x.disabled=false)}});
  d.showModal()};
let fmAudio=null;
{const st=document.createElement('style');st.textContent=`#fmDialog{width:min(520px,94vw)}.fm-list{display:flex;flex-direction:column;gap:6px;max-height:min(60vh,520px);overflow:auto;margin:10px 0}
.fm-row{display:flex;align-items:center;gap:10px;padding:6px 8px;border:1px solid var(--ts-border,#8884);border-radius:12px}.fm-row span{flex:1;min-width:0}.fm-row b,.fm-row small{display:block}.fm-row small{opacity:.65;font-size:12px}
.fm-play{width:40px;height:40px;padding:0!important;border-radius:50%!important;flex:none}`;document.head.appendChild(st)}
{let g=[...document.querySelectorAll('.timebar button')].find(b=>/Review|Graphics/.test(b.textContent)),b=document.createElement('button');b.type='button';b.textContent='🎞️ B-roll Video';b.title='Build a video from your clips with a story template and free music';b.onclick=()=>open();if(g)g.after(b);else document.querySelector('.timebar')?.appendChild(b)}
// The two quick makers (this one and ⭐ Reviews) sit together at the top of the start screen, right under
// its intro and above Recent videos. Other scripts add things after the intro later, so keep them in place.
function startButton(){let start=$$('veStart'),lead=start?.querySelector('.vs-lead');if(!lead)return;
  let box=$$('vsQuick');if(!box){box=document.createElement('div');box.id='vsQuick';box.className='vs-quick'}
  if(!box.querySelector('.vs-qh')){let h=document.createElement('div');h.className='vs-qh';h.innerHTML='<h2>Quick Video Makers</h2><p class="vs-help">Pick one and it builds the video for you.</p>';box.prepend(h)}
  if(!$$('vsBroll')){let b=document.createElement('button');b.type='button';b.id='vsBroll';b.className='vs-reviews';
    b.innerHTML='<b>🎞️ B-roll Video Maker</b><span>Drop in your raw b-roll clips and get a finished, ready-to-post video: auto captions, a hook and call to action, free music, best moments picked, and cuts and zooms on the beat. Little or no editing needed.</span>';
    b.onclick=()=>{let go=$$('vsGo');if(go)go.click();let el=$$('veStart');if(el)el.hidden=true;setTimeout(()=>open(true),60)};box.appendChild(b)}
  let rv=$$('vsReviews');if(rv&&rv.parentElement!==box)box.appendChild(rv);
  if(lead.nextElementSibling!==box)lead.after(box)}
new MutationObserver(startButton).observe(document.body,{childList:true,subtree:true});startButton();
})();
