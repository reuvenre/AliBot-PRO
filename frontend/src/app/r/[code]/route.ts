import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

/**
 * Public short-link redirect on the pretty domain: nexlify…/r/<code> → the post's
 * affiliate URL. The backend resolve call also RECORDS the click (that call is the
 * click). Unknown/expired codes fall back to SHORT_LINK_FALLBACK_URL (the store's
 * public page, e.g. the Telegram channel) when set — NEVER the app's marketing
 * homepage, which is confusing for a shopper who clicked a product ad.
 */
const FALLBACK = (process.env.SHORT_LINK_FALLBACK_URL || '').trim();

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // The platform tag (?s=tg/fb/…) each send path stamps on its link — forwarded so the
  // backend can record WHICH platform produced the click.
  const src = req.nextUrl.searchParams.get('s') || '';
  try {
    const res = await fetch(`${API}/r/${encodeURIComponent(code)}/resolve${src ? `?s=${encodeURIComponent(src)}` : ''}`, {
      headers: {
        'x-forwarded-referrer': req.headers.get('referer') || '',
        'user-agent': req.headers.get('user-agent') || '',
      },
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => null)) as { url?: string | null } | null;
    if (data?.url) return NextResponse.redirect(data.url, 302);
  } catch { /* fall through to the configured fallback */ }
  // A configured store URL beats the marketing homepage for an orphaned/expired link.
  if (/^https?:\/\//i.test(FALLBACK)) return NextResponse.redirect(FALLBACK, 302);
  return NextResponse.redirect(new URL('/', req.url), 302);
}
