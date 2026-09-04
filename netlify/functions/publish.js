/** Netlify wrapper for the rebuild trigger. See api/publish.js. */
import { verifyCaller, bearer } from '../../api/_users-core.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const headers = event.headers || {};
  const caller = await verifyCaller(bearer(headers.authorization || headers.Authorization));
  if (!caller) return json(401, { error: 'Sign in first.' });

  const hook = process.env.DEPLOY_HOOK_URL || '';
  if (!hook) {
    return json(501, {
      error: 'not_configured',
      message:
        'Add DEPLOY_HOOK_URL as an environment variable on the host, then redeploy. ' +
        'Create the hook in Netlify under Build & deploy → Build hooks.',
    });
  }

  try {
    const r = await fetch(hook, { method: 'POST' });
    if (!r.ok) return json(502, { error: `The deploy hook answered ${r.status}.` });
    return json(200, { triggered: true, by: caller.email });
  } catch {
    return json(502, { error: 'Could not reach the deploy hook.' });
  }
};
