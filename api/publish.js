/**
 * "Publish to site" — triggers a rebuild of the static site.
 *
 * The deploy hook URL lives here as a server-side env var rather than in the
 * panel's Settings: it is infrastructure config, not content, and holding it
 * server-side keeps it out of the browser entirely.
 *
 * Environment:
 *   DEPLOY_HOOK_URL   the Vercel deploy hook / Netlify build hook to POST to
 */
import { verifyCaller, bearer } from './_users-core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const caller = await verifyCaller(bearer(req.headers.authorization));
  if (!caller) return res.status(401).json({ error: 'Sign in first.' });

  const hook = process.env.DEPLOY_HOOK_URL || '';
  if (!hook) {
    return res.status(501).json({
      error: 'not_configured',
      message:
        'Add DEPLOY_HOOK_URL as an environment variable on the host, then redeploy. ' +
        'Create the hook in Vercel under Project → Settings → Git → Deploy Hooks, ' +
        'or in Netlify under Build & deploy → Build hooks.',
    });
  }

  try {
    const r = await fetch(hook, { method: 'POST' });
    if (!r.ok) {
      return res.status(502).json({ error: `The deploy hook answered ${r.status}.` });
    }
    return res.status(200).json({ triggered: true, by: caller.email });
  } catch {
    return res.status(502).json({ error: 'Could not reach the deploy hook.' });
  }
}
