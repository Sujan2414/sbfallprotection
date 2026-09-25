/**
 * Keeps the Supabase project from being paused.
 *
 * A free project is paused after roughly a week without API traffic, which
 * takes the admin console and the enquiry forms down with it. Vercel's cron
 * calls this once a day (see vercel.json) and one read of one catalogue row
 * counts as traffic. The GitHub Actions workflow does the same thing from a
 * different platform, so either one failing on its own still leaves the
 * project awake.
 *
 * The anon key may only read the catalogue, so this touches nothing.
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_ANON_KEY   already set for the build
 *   CRON_SECRET                       optional; when set, Vercel sends it and
 *                                     any other caller is turned away
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.CRON_SECRET || '';
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Not the scheduler.' });
  }

  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    return res.status(501).json({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY is not set.' });
  }

  try {
    const r = await fetch(`${url}/rest/v1/products?select=sku&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      return res.status(502).json({ awake: false, status: r.status });
    }
    return res.status(200).json({ awake: true, at: new Date().toISOString() });
  } catch {
    // no answer at all usually means the project is already paused
    return res.status(502).json({ awake: false, error: 'No answer from Supabase.' });
  }
}
