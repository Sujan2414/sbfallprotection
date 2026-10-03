/**
 * Page content staff edit in the admin panel: the About page and the FAQs.
 * Each is one JSON document in the settings table, read once per build. The
 * defaults are what the pages said before the panel could edit them, and
 * apply whenever the setting is missing or unreadable, so a page can never
 * build empty.
 */
import { setting } from './supabase';

export interface Figure { n: string; l: string }
export interface Leader { name: string; role: string; photo: string; bio: string }
export interface Cert { name: string; note: string; logo: string; alt?: string }
export interface Recognition { name: string; note: string }
export interface About {
  heroLead: string;
  quote: string;
  paragraphs: string[];
  photo: string;
  years: string;
  badge: string;
  badgeNote: string;
  figures: Figure[];
  leadership: Leader[];
  certs: Cert[];
  recognitions: Recognition[];
}

export const DEFAULT_ABOUT: About = {
  heroLead: 'An Indian manufacturer of certified height-safety equipment, supplying distributors, EPC contractors and safety companies worldwide from a single integrated facility.',
  quote: 'Safety applies with equal force to the individual, to the family, to the employer and to the state.',
  paragraphs: [
    'SB International was established in 2003 and grew from precision leather craft into one of India\'s dedicated fall-protection manufacturers. What began as an equestrian and personal protective equipment workshop is today a 195,000 sq ft integrated plant in Kanpur, Uttar Pradesh.',
    'SB International runs four units today, and SB Fall Protection has grown into one of India\'s leading manufacturing hubs for fall-protection equipment. Because webbing, stitching, hardware assembly, finishing and packing all happen in-house, quality control never leaves the building — and custom or private-label products can be developed to a buyer\'s exact specification.',
    'The plant has its own testing facility and laboratory, where any product can be tested against BIS, CE, ANSI or other international PPE standards before it ships.',
    'The company is a Government of India recognised Export House, certified by the Council for Leather Exports. The United States is our largest market, alongside customers across Europe, the Middle East, Africa, Latin America and Asia-Pacific.',
  ],
  photo: '/assets/about-factory.jpg',
  years: '20+',
  badge: 'ISO 9001:2015 · SEDEX',
  badgeNote: 'Certified & Audited',
  figures: [
    { n: '2003', l: 'Founded in Kanpur, Uttar Pradesh' },
    { n: '195,000', l: 'Sq ft integrated facility' },
    { n: '290+', l: 'Skilled professionals on the floor' },
    { n: '232+', l: 'Product codes in the catalogue' },
  ],
  leadership: [
    { name: 'Mr. Biju Abraham', role: 'Managing Partner', photo: '/assets/team-biju.jpg',
      bio: 'Over two decades in product design and marketing for personal protective equipment, leading the design direction and export business.' },
    { name: 'Mr. Saji Thomas', role: 'Partner', photo: '/assets/team-saji.jpg',
      bio: 'Oversees financial management, strategic planning and regulatory compliance across the manufacturing and export operation.' },
  ],
  certs: [
    { name: 'ISO 9001:2015', logo: '/assets/cert-iso-9001.png', alt: 'ISO 9001:2015 certified company',
      note: 'Quality management system certified across design, manufacturing and dispatch.' },
    { name: 'SEDEX Member', logo: '/assets/cert-sedex.jpg', alt: 'SEDEX certified company, reference ZS1000032714',
      note: 'Ethical trade audit on labour standards, health and safety, and environment.' },
  ],
  recognitions: [
    { name: 'Govt. of India Recognised Export House', note: 'Directorate General of Foreign Trade' },
    { name: 'Council for Leather Exports', note: 'Registered member and certified exporter' },
    { name: 'EN & ANSI Type-Tested', note: 'Third-party tested to European and American standards' },
  ],
};

export async function getAbout(): Promise<About> {
  const saved = await setting<Partial<About>>('about');
  if (!saved || typeof saved !== 'object') return DEFAULT_ABOUT;
  const out = { ...DEFAULT_ABOUT };
  for (const k of Object.keys(out) as (keyof About)[]) {
    const v = saved[k];
    if (Array.isArray(out[k])) {
      // an emptied list is a choice staff made; a missing one falls back
      if (Array.isArray(v)) (out as any)[k] = v;
    } else if (typeof v === 'string' && v.trim()) {
      (out as any)[k] = v.trim();
    }
  }
  return out;
}

export interface Faq { q: string; a: string }

/** "{email}" in an answer becomes the address set under Contact. */
export const DEFAULT_FAQS: Faq[] = [
  { q: 'Do you manufacture custom or private-label gear?',
    a: 'Yes. In-house designers and pattern masters develop products to buyer specifications — from adjusted webbing configurations to fully private-labelled ranges with your branding and packaging.' },
  { q: 'Which certifications and audits do you hold?',
    a: 'Our quality system is certified to ISO 9001:2015 and production is SEDEX-audited for ethical practices. SB International is also a Government of India recognised Export House. Product-level test documentation is shared with quotations on request.' },
  { q: 'Where do you export?',
    a: 'The United States is our largest market, alongside customers worldwide. Export documentation, labelling and packing are all handled in-house.' },
  { q: 'What are your MOQs and lead times?',
    a: 'Both vary by product and configuration. Send your requirement through the quote form and you\'ll receive MOQ, lead time and pricing together in one response.' },
  { q: 'How is quality controlled?',
    a: 'Dedicated quality controllers inspect at every stage — incoming materials, in-process stitching and hardware, and finished goods — with stringent batch testing before dispatch.' },
  { q: 'How do I get the full catalogue?',
    a: 'Email {email} or submit the quote form and the team will send the latest edition with current specifications.' },
];

export async function getFaqs(email: string): Promise<Faq[]> {
  const saved = await setting<Faq[]>('faqs');
  const list = Array.isArray(saved) ? saved.filter((f) => f && f.q && f.a) : DEFAULT_FAQS;
  return list.map((f) => ({ q: String(f.q), a: String(f.a).replaceAll('{email}', email) }));
}

export interface MenuItem { label: string; href: string }

/** The links in the top bar and the mobile menu; Contact Now stays fixed beside them. */
export const DEFAULT_MENU: MenuItem[] = [
  { label: 'Products', href: '/products' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Export Markets', href: '/export-markets' },
];

export async function getMenu(): Promise<MenuItem[]> {
  const saved = await setting<MenuItem[]>('menu');
  if (!Array.isArray(saved)) return DEFAULT_MENU;
  return saved.filter((m) => m && m.label && m.href).map((m) => ({ label: String(m.label), href: String(m.href) }));
}

export interface Brand { logo: string; favicon: string }
export const DEFAULT_BRAND: Brand = { logo: '/assets/sb-logo.png', favicon: '/assets/sb-logo.png' };

export async function getBrand(): Promise<Brand> {
  const saved = await setting<Partial<Brand>>('brand');
  const out = { ...DEFAULT_BRAND };
  if (saved && typeof saved === 'object') {
    for (const k of ['logo', 'favicon'] as const) if (typeof saved[k] === 'string' && saved[k]!.trim()) out[k] = saved[k]!.trim();
  }
  return out;
}
