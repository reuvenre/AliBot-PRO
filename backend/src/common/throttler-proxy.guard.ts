import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit by the REAL client IP, not the reverse proxy. The API runs behind Cloudflare +
 * the platform router, so `req.ip` is the edge IP — without this, the global ThrottlerGuard
 * buckets EVERY customer under one IP and the 100/min limit becomes a platform-wide cap
 * (the 101st request anywhere → 429). Prefer Cloudflare's trusted `CF-Connecting-IP` (which
 * a client can't spoof through Cloudflare), then the left-most X-Forwarded-For, then req.ip.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cf = req.headers?.['cf-connecting-ip'];
    if (cf) return Array.isArray(cf) ? cf[0] : String(cf);
    const xff = req.headers?.['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
    return req.ip;
  }
}
