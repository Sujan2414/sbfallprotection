/**
 * Enquiry notifications over Microsoft 365 SMTP.
 *
 * The browser posts only an enquiry id — never the message body. This function
 * reads that row back from Supabase with the service_role key and mails it. So
 * the endpoint cannot be used as an open relay: an attacker can neither choose
 * the recipient nor write the content, only ask for a real, recent row to be
 * re-sent, which `notified_at` then stops from happening twice.
 *
 * Environment:
 *   SMTP_USER   the mailbox that sends, e.g. sales@sbfallprotection.com
 *   SMTP_PASS   its app password (M365 blocks plain passwords when MFA is on)
 *   SMTP_TO     optional, comma-separated recipients. Defaults to SMTP_USER.
 *   SMTP_HOST   optional, defaults to smtp.office365.com
 *   SMTP_PORT   optional, defaults to 587 (STARTTLS)
 */
import nodemailer from 'nodemailer';

const env = (k, fallback = '') => process.env[k] || fallback;
const reply = (status, json) => ({ status, json });

/** Only mail rows this fresh, so an old id cannot be replayed later. */
const MAX_AGE_MINUTES = 30;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function sbFetch(path, init = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + path;
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(url, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* 204 */ }
  return { ok: res.ok, status: res.status, body };
}

function render(q) {
  const rows = [
    ['Name', q.name],
    ['Company', q.company],
    ['Email', q.email],
    ['Phone', q.phone],
    ['Destination', q.country],
    ['Category', q.category],
    ['Product code', q.sku],
    ['From page', q.source_page],
  ].filter(([, v]) => v);

  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\n${q.message || ''}\n\n— sent automatically by sbfallprotection.com`;

  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;color:#131312">
    <p style="margin:0 0 18px;font-size:17px"><strong>New enquiry from the website</strong></p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:5px 18px 5px 0;color:#6e6e6f;white-space:nowrap">${esc(k)}</td>
        <td style="padding:5px 0;font-weight:600">${esc(v)}</td>
      </tr>`).join('')}
    </table>
    ${q.message ? `<div style="background:#f4f4f4;border-radius:10px;padding:14px 16px;
      white-space:pre-wrap;line-height:1.6">${esc(q.message)}</div>` : ''}
    ${q.email ? `<p style="margin:20px 0 0">
      <a href="mailto:${esc(q.email)}" style="color:#fe5922;font-weight:600">Reply to ${esc(q.email)}</a>
    </p>` : ''}
    <p style="margin:22px 0 0;font-size:12.5px;color:#9a9a99">
      Sent automatically by sbfallprotection.com</p>
  </div>`;

  const who = q.company || q.name || 'website visitor';
  return {
    subject: `New enquiry — ${who}${q.sku ? ` (${q.sku})` : ''}`,
    text,
    html,
  };
}

/** @param {{method: string, body: any}} req */
export async function handleNotify(req) {
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });

  if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) {
    return reply(501, { error: 'not_configured' });
  }
  if (!env('SMTP_USER') || !env('SMTP_PASS')) {
    return reply(501, { error: 'not_configured' });
  }

  const id = String((req.body && req.body.id) || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(400, { error: 'bad_id' });

  const { ok, body } = await sbFetch(
    `/rest/v1/inquiries?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!ok || !Array.isArray(body) || body.length === 0) {
    return reply(404, { error: 'not_found' });
  }
  const q = body[0];

  // already mailed, or old enough that this is a replay rather than a submission
  if (q.notified_at) return reply(200, { skipped: 'already_sent' });
  const ageMin = (Date.now() - new Date(q.created_at).getTime()) / 60000;
  if (ageMin > MAX_AGE_MINUTES) return reply(200, { skipped: 'too_old' });

  const { subject, text, html } = render(q);
  const transport = nodemailer.createTransport({
    host: env('SMTP_HOST', 'smtp.office365.com'),
    port: Number(env('SMTP_PORT', '587')),
    secure: false,                       // STARTTLS on 587, not implicit TLS
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });

  try {
    await transport.sendMail({
      from: `"SB Fall Protection" <${env('SMTP_USER')}>`,
      to: env('SMTP_TO', env('SMTP_USER')),
      replyTo: q.email || undefined,     // hitting reply answers the customer
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[notify] smtp', err && err.message);
    return reply(502, { error: 'send_failed' });
  }

  // best effort: a failed stamp costs a duplicate, not a lost enquiry
  await sbFetch(`/rest/v1/inquiries?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ notified_at: new Date().toISOString() }),
  });

  return reply(200, { sent: true });
}
