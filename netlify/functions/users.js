/**
 * Netlify wrapper around the same staff-account handler, so the admin panel
 * keeps working when the site moves off Vercel. netlify.toml redirects
 * /api/users here, which is the path the panel calls on both hosts.
 */
import { handleUsers, bearer } from '../../api/_users-core.js';

export const handler = async (event) => {
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); } catch { body = {}; }
  }
  const headers = event.headers || {};

  const { status, json } = await handleUsers({
    method: event.httpMethod,
    token: bearer(headers.authorization || headers.Authorization),
    body,
  });

  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(json),
  };
};
