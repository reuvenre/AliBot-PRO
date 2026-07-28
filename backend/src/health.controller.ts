import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Deep health check: the process being up is NOT enough — it verifies the
   * database is actually reachable with a trivial `SELECT 1`.
   *
   * Returns 503 when the DB can't be queried. This matters because Render uses
   * this path as its deploy health check: a shallow "always ok" let a
   * DB-disconnected instance pass health and serve 500s to real users
   * (exactly the outage this replaces). A 503 here makes Render reject a
   * DB-disconnected deploy, and lets any external monitor tell "up but
   * DB-down" apart from genuinely healthy.
   */
  @Get()
  async check() {
    try {
      await this.ds.query('SELECT 1');
    } catch (err: any) {
      // Log the real error server-side, but never return it — a raw Postgres error can
      // disclose host/port/database name to an anonymous caller. Keep the body generic.
      console.error('[health] DB check failed:', err?.message);
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
        timestamp: new Date().toISOString(),
      });
    }
    return { status: 'ok', db: 'up', timestamp: new Date().toISOString() };
  }
}
