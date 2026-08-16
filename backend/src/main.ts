import 'reflect-metadata';
import { setDefaultResultOrder } from 'node:dns';

/**
 * Resolve IPv4 FIRST for every outbound request.
 *
 * Node 18+ defaults to 'verbatim' — it tries the addresses in the order DNS returned them,
 * which usually means the AAAA (IPv6) record first. On a host whose IPv6 route is
 * blackholed the connect doesn't fail fast, it hangs until the OS gives up, and Happy
 * Eyeballs surfaces that as an AggregateError whose inner code is ETIMEDOUT.
 *
 * That is the exact signature behind the recurring "published partially" alerts — and it
 * hit Telegram and Meta alike within the same hours. Two unrelated destinations failing
 * the same way is not two outages; it is our own egress. Preferring IPv4 skips the dead
 * path entirely instead of paying its timeout on every publish.
 */
setDefaultResultOrder('ipv4first');
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { installRetryAfterInterceptor } from './common/http-retry';

// Honor 429 Retry-After (Telegram/FB/etc.) globally with one backed-off retry.
installRetryAfterInterceptor();

// Crash safety: since Node 15 an unhandled promise rejection KILLS the process —
// on a free single-instance host that reads as "the server randomly falls over".
// Log loudly and keep serving instead of dying; the offending flow already failed
// on its own and every scheduler tick is individually try/catch-guarded.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

async function bootstrap() {
  // rawBody:true keeps the unparsed request body available (req.rawBody) so payment-webhook
  // signatures can be verified over the exact bytes the provider signed.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // The default 100kb JSON body is too small for one thing we accept as text: the
  // AliExpress portal's order export, pasted whole into the reconciliation check. A
  // year of orders is a few hundred KB, and the failure mode is a bare 413 that reads
  // like the feature is broken.
  app.useBodyParser('json', { limit: '5mb' });

  // Behind Cloudflare + the platform router — trust the proxy chain so req.ip / secure
  // reflect the real client, and the rate limiter buckets per client (see
  // ThrottlerBehindProxyGuard) instead of collapsing everyone onto the edge IP.
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Security headers. The API serves JSON + the streamed image proxy — no first-party
  // HTML app — so a restrictive CSP is safe. HSTS is enabled in prod (behind TLS).
  const isProd = process.env.NODE_ENV === 'production';

  // Production schema bootstrap: on a truly EMPTY database (fresh deploy / DR / new region)
  // build the baseline from the entities via synchronize, THEN run migrations. On the
  // existing populated DB the synchronize step is skipped and only migrations run — so this
  // is a no-op there, but a clean rebuild no longer dies on the first ALTER of a missing table.
  if (isProd) {
    const ds = app.get(DataSource);
    try {
      const rows = await ds.query(`SELECT to_regclass('public.users') AS t`);
      const dbIsEmpty = !rows?.[0]?.t;
      // Baseline the schema from entities ONLY on a truly empty DB, and only when auto-DDL
      // isn't opted out. This is the only thing DB_SYNC gates.
      if (dbIsEmpty && process.env.DB_SYNC !== 'false') {
        console.log('[bootstrap] empty database detected — building baseline schema from entities');
        await ds.synchronize();
      }
      // Migrations ALWAYS run in production, regardless of DB_SYNC — otherwise a new column
      // (e.g. posts.pending_at) is missing and every query that references it throws, silently
      // killing the send pipeline. DB_SYNC=false must disable synchronize, never migrations.
      await ds.runMigrations();
      console.log('[bootstrap] migrations applied');
    } catch (err) {
      console.error('[bootstrap] schema bootstrap failed', err);
      throw err;
    }
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // image proxy is fetched cross-origin
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Allow the configured frontend(s), local dev, the project's production domain,
  // and the project's OWN Vercel preview deployments. credentials:true can't use a
  // wildcard, so we reflect the origin when it matches. We do NOT reflect every
  // *.vercel.app — that would let any attacker deploy a site to Vercel and make
  // credentialed requests. Restrict to specific hosts + the team suffix.
  // FRONTEND_URL accepts a comma-separated list for multiple domains.
  const allowList = [
    ...(process.env.FRONTEND_URL || '').split(',').map((s) => s.trim()).filter(Boolean),
    // localhost is a dev convenience only — never reflect it as a credentialed origin in prod.
    ...(isProd ? [] : ['http://localhost:3000']),
  ];
  // The project's main production domain does NOT carry the team suffix
  // (ali-bot-pro.vercel.app vs *-reuvenres-projects.vercel.app) — allow it explicitly.
  const allowedHosts = [...(isProd ? [] : ['localhost']), 'ali-bot-pro.vercel.app'];
  // e.g. "-reuvenres-projects.vercel.app" — override via env if the team slug changes.
  const vercelSuffix = process.env.CORS_VERCEL_SUFFIX || '-reuvenres-projects.vercel.app';
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser / same-origin
      let host = '';
      try { host = new URL(origin).hostname; } catch { /* ignore */ }
      const ok =
        allowList.includes(origin) ||
        allowedHosts.includes(host) ||
        host.endsWith(vercelSuffix);
      cb(null, ok);
    },
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Nexlify PRO backend running on port ${port}`);
}
bootstrap();
