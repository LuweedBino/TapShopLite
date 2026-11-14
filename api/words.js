// Cloud AI for the B-roll Video Maker: a small Vercel function that keeps the Groq key secret.
//
// POST audio/wav (16 kHz mono)  → { words: [{w, s, e}], left }   Groq Whisper writes down every word with its time.
// POST application/json {words} → { drop: [index, ...] }         Groq's text AI finds fumbles and retakes.
//
// Headers: Authorization: Bearer <Supabase access token> (when sign-in is on), x-build: one id per video build.
// One video build counts as one use, however many requests it takes. Settings (Vercel → Settings → Environment
// Variables): GROQ_API_KEY (required; without it the app quietly uses the on-device AI), SUPABASE_SECRET_KEY
// (for the daily limit per person; stored in each user's app_metadata, which users can't change),
// AI_PER_DAY (default 10). Setup steps: AI-SETUP.md.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxlaoosagblbojazxwix.supabase.co';
const SUPABASE_PUBLIC = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_aHXFnsZbjrjnPXmj6Kln0w_nluXaPjX';
const PER_DAY = Math.max(1, parseInt(process.env.AI_PER_DAY || '10', 10) || 10);
const MAX_BYTES = 4.3 * 1024 * 1024;
// Whisper tends to leave out "um"s; an example full of them makes it keep them, so they can be cut.
const PROMPT = 'Umm, so, uh, I was like... hmm, let me think. Uh, yeah, um, okay.';
const LANGS = new Set(['en', 'es', 'fr', 'pt', 'de', 'it', 'tl', 'hi', 'ja', 'ko', 'zh', 'ar']);

const send = (res, code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
const fail = (res, code, key, error) => send(res, code, { code: key, error });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

async function rawBody(req) {
  const parts = []; let size = 0;
  for await (const c of req) { const b = Buffer.isBuffer(c) ? c : Buffer.from(c); size += b.length; if (size > MAX_BYTES) throw Object.assign(Error('too big'), { big: true }); parts.push(b); }
  return Buffer.concat(parts);
}

async function user(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_PUBLIC, authorization: 'Bearer ' + token } });
  return r.ok ? r.json() : null;
}

// Counts one use per build per person per day. Returns uses left today, or -1 when the limit is reached.
async function countUse(u, build) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !u) return null;
  const m = u.app_metadata || {}, day = today();
  let ai = m.ai && m.ai.day === day ? m.ai : { day, n: 0, builds: [] };
  if (ai.builds.includes(build)) return PER_DAY - ai.n;
  if (ai.n >= PER_DAY) return -1;
  ai = { day, n: ai.n + 1, builds: [...ai.builds, build].slice(-PER_DAY) };
  await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + u.id, { method: 'PUT',
    headers: { apikey: secret, authorization: 'Bearer ' + secret, 'content-type': 'application/json' },
    body: JSON.stringify({ app_metadata: { ...m, ai } }) });
  return PER_DAY - ai.n;
}

async function transcribe(buf, lang) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
  fd.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  fd.append('temperature', '0');
  fd.append('prompt', PROMPT);
  if (LANGS.has(lang)) fd.append('language', lang);
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: fd });
  if (r.status === 429) throw Object.assign(Error('The free cloud AI is busy right now.'), { code: 'busy' });
  if (!r.ok) throw Object.assign(Error('Groq said ' + r.status), { code: 'groq' });
  const j = await r.json();
  return (j.words || []).map(w => ({ w: String(w.word).trim(), s: +w.start, e: +w.end })).filter(w => w.w && Number.isFinite(w.s) && Number.isFinite(w.e));
}

// Asks Groq's text AI which words are mistakes: false starts, repeated lines and abandoned retakes.
async function fumbles(words) {
  if (words.length < 6) return [];
  const list = words.map((w, i) => i + ':' + w).join(' ');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST',
    headers: { authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile', temperature: 0, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You edit spoken video takes. You get numbered words (index:word) from someone talking to camera. Find the mistakes a video editor would cut: false starts, stutters, words or phrases said twice in a row, sentences started and abandoned, and earlier tries of a line that is said again later (keep only the LAST complete try). Also mark whole throwaway takes between "|" clip breaks: a clip that is only "okay", "let me start over", "one more time", "sorry", a cough or a test count. Never mark normal speech, and never mark filler words like um or uh (those are handled separately). Reply with JSON only: {"drop":[[first,last],...]} using inclusive index ranges, or {"drop":[]} if there are no mistakes.' },
        { role: 'user', content: list }] }) });
  if (!r.ok) return [];
  try {
    const j = JSON.parse((await r.json()).choices[0].message.content), out = new Set();
    for (const x of j.drop || []) { const [a, b] = Array.isArray(x) ? x : [x, x]; for (let i = Math.max(0, a | 0); i <= Math.min(words.length - 1, b | 0); i++) out.add(i); }
    // A safety net: never let it cut more than half of what was said.
    return out.size > words.filter(w => w !== '|').length / 2 ? [] : [...out].sort((a, b) => a - b);
  } catch { return []; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'method', 'Use POST.');
  if (!process.env.GROQ_API_KEY) return fail(res, 503, 'off', 'Cloud AI isn’t set up.');
  try {
    const u = await user(req);
    if (!u && process.env.AI_REQUIRE_SIGNIN !== 'off') return fail(res, 401, 'auth', 'Please sign in again.');
    const build = String(req.headers['x-build'] || '').slice(0, 64);
    if (!/^[\w-]{8,}$/.test(build)) return fail(res, 400, 'build', 'Missing build id.');
    const type = String(req.headers['content-type'] || '');
    if (type.includes('application/json')) {
      let body = {}; try { body = JSON.parse((await rawBody(req)).toString('utf8') || '{}'); } catch { return fail(res, 400, 'read', 'Bad request.'); }
      const words = Array.isArray(body.words) ? body.words.slice(0, 3000).map(w => String(w).slice(0, 40)) : [];
      const m = u && u.app_metadata && u.app_metadata.ai;
      // Only for a build that already counted today, so this can't be used on its own for free.
      if (process.env.SUPABASE_SECRET_KEY && !(m && m.day === today() && (m.builds || []).includes(build))) return fail(res, 403, 'build', 'Unknown build.');
      return send(res, 200, { drop: await fumbles(words) });
    }
    const left = await countUse(u, build);
    if (left === -1) return fail(res, 429, 'limit', `You’ve used today’s ${PER_DAY} cloud AI videos. It resets tomorrow.`);
    let buf;
    try { buf = await rawBody(req); } catch (e) { return e.big ? fail(res, 413, 'big', 'Too much sound in one go.') : fail(res, 400, 'read', 'Couldn’t read the sound.'); }
    if (buf.length < 1000 || buf.toString('ascii', 0, 4) !== 'RIFF') return fail(res, 400, 'read', 'That isn’t sound we can use.');
    const words = await transcribe(buf, String(req.headers['x-lang'] || ''));
    return send(res, 200, { words, left });
  } catch (e) {
    return fail(res, e.code === 'busy' ? 429 : 502, e.code || 'error', e.message || 'Cloud AI error.');
  }
};
