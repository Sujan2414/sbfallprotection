/**
 * When this build ran. The admin panel's publishing indicator compares it
 * with the moment it asked for a rebuild: once this is newer, the change is
 * live. Written at build time, so it needs no token and no Vercel API.
 */
export const prerender = true;

export function GET() {
  return new Response(JSON.stringify({ builtAt: Date.now() }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
