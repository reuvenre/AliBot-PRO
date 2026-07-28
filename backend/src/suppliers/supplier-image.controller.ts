import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

/**
 * Public image proxy for Yupoo photos. Yupoo hotlink-protects images (returns 567
 * without a yupoo Referer), so neither the browser nor Telegram can load them
 * directly. This endpoint fetches with the required Referer and streams the bytes.
 *
 * PUBLIC (no JWT) on purpose — Telegram fetches the image server-side and cannot
 * send an auth header. SSRF is contained by (a) only allowing *.yupoo.com hosts and
 * (b) refusing to follow redirects — otherwise a yupoo URL that 302s to an internal
 * address (e.g. cloud metadata) would be fetched and streamed back. Rate-limited too.
 */
@Controller('suppliers')
export class SupplierImageController {
  @Get('image')
  async image(@Query('url') url: string, @Res() res: Response) {
    let host = '';
    try { host = new URL(url).hostname; } catch { throw new BadRequestException('bad url'); }
    if (!/(^|\.)yupoo\.com$/i.test(host)) throw new BadRequestException('forbidden host');

    const upstream = await axios.get(url, {
      responseType: 'arraybuffer',
      // Never follow redirects: the initial host is validated but a redirect target
      // is not, so following one re-opens the SSRF hole. A 30x becomes a non-200 → 502.
      maxRedirects: 0,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        // A fixed x.yupoo.com referer satisfies the hotlink check for any store.
        Referer: 'https://x.yupoo.com/',
      },
      timeout: 12000, maxContentLength: 8 * 1024 * 1024, validateStatus: () => true,
    });
    if (upstream.status !== 200) { res.status(502).send('image unavailable'); return; }

    res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'image/jpeg'));
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    res.send(Buffer.from(upstream.data));
  }
}
