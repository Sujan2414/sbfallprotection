/**
 * Vercel serverless wrapper around the staff-account handler.
 * Vercel picks up files under /api regardless of the static Astro build.
 */
import { handleUsers, bearer } from './_users-core.js';

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { status, json } = await handleUsers({
    method: req.method,
    token: bearer(req.headers.authorization),
    body: body || {},
  });

  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(json);
}
