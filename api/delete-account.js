// Deletes the signed-in person's own account (the account page's "Delete my account"). Supabase only lets the
// secret key delete users, so this small Vercel function checks who is asking from their sign-in token,
// then deletes exactly that user. Needs SUPABASE_SECRET_KEY (already set for the cloud AI's daily limit).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxlaoosagblbojazxwix.supabase.co';
const SUPABASE_PUBLIC = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_aHXFnsZbjrjnPXmj6Kln0w_nluXaPjX';
const send = (res, code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return send(res, 503, { error: 'Account deletion isn’t set up yet. Please email us and we’ll delete it.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return send(res, 401, { error: 'Please sign in again.' });
  try {
    const me = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_PUBLIC, authorization: 'Bearer ' + token } });
    if (!me.ok) return send(res, 401, { error: 'Please sign in again.' });
    const user = await me.json();
    if (!user || !user.id) return send(res, 401, { error: 'Please sign in again.' });
    const del = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(user.id), { method: 'DELETE', headers: { apikey: secret, authorization: 'Bearer ' + secret } });
    if (!del.ok) return send(res, 502, { error: 'We couldn’t delete the account right now. Please try again.' });
    return send(res, 200, { deleted: true });
  } catch {
    return send(res, 502, { error: 'We couldn’t delete the account right now. Please try again.' });
  }
};
