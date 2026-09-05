/** Netlify wrapper for the enquiry notifier. See api/_notify-core.js. */
import { handleNotify } from '../../api/_notify-core.js';

export const handler = async (event) => {
  let body = {};
  if (event.body) { try { body = JSON.parse(event.body); } catch { body = {}; } }
  const { status, json } = await handleNotify({ method: event.httpMethod, body });
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(json),
  };
};
