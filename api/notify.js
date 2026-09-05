/** Vercel wrapper for the enquiry notifier. See api/_notify-core.js. */
import { handleNotify } from './_notify-core.js';

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { status, json } = await handleNotify({ method: req.method, body: body || {} });
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(json);
}
