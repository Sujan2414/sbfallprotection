/**
 * SB's contact details, edited under Contact in the admin panel and read here
 * once per build. Every page that shows a phone number, the email address,
 * the address or the hours takes them from this, so one change in the panel
 * updates the whole site. The defaults are what the site showed before, and
 * apply if the setting cannot be read.
 */
import { setting } from './supabase';

export interface Contact {
  phone: string;
  phone2: string;
  email: string;
  whatsapp: string;
  /** one line per row, as it should appear on the contact page */
  address: string;
  hours: string;
  /** "latitude,longitude" for the map pin */
  map: string;
}

export const DEFAULT_CONTACT: Contact = {
  phone: '+91 512 240 6728',
  phone2: '+91 512 240 6947',
  email: 'sales@sbfallprotection.com',
  whatsapp: '+91 95440 70143',
  address: 'Plot C-17 to C-19, UPSIDC Industrial Area,\nTextile Zone, Rooma, Kanpur — 208008,\nUttar Pradesh, India',
  hours: 'Monday – Saturday, 9:00 – 18:00 IST',
  map: '26.35932594666212,80.43686518465555',
};

let cache: Promise<Contact> | null = null;

export function getContact(): Promise<Contact> {
  cache ??= (async () => {
    try {
      const saved = ((await setting<Record<string, unknown>>('contact')) ?? {}) as Record<string, any>;
      // a field left empty in the panel falls back rather than vanishing
      const out = { ...DEFAULT_CONTACT };
      for (const k of Object.keys(out) as (keyof Contact)[]) {
        if (k === 'phone2' && typeof saved[k] === 'string') out[k] = saved[k].trim();
        else if (typeof saved[k] === 'string' && saved[k].trim()) out[k] = saved[k].trim();
      }
      return out;
    } catch {
      return DEFAULT_CONTACT;
    }
  })();
  return cache;
}

/** tel: link for a number written any way, "+91 512 240 6728" -> tel:+915122406728 */
export const tel = (n: string) => `tel:${String(n).replace(/[^\d+]/g, '')}`;

/** WhatsApp link, which wants digits only */
export const waLink = (n: string, text?: string) =>
  `https://wa.me/${String(n).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const addressLines = (c: Contact) => c.address.split('\n').map((l) => l.trim()).filter(Boolean);

/** the address on one line, for the footer and short blocks */
export const addressOneLine = (c: Contact) => addressLines(c).join(' ').replace(/,\s*,/g, ',');

/** every phone number that is set */
export const phones = (c: Contact) => [c.phone, c.phone2].filter(Boolean);
