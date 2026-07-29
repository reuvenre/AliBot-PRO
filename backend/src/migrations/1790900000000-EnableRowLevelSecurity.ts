import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable RLS on every table in `public`.
 *
 * Supabase exposes the `public` schema through PostgREST, so any table there is reachable
 * over the internet by anyone holding the project's anon key — a key Supabase treats as
 * publishable. Nexlify never uses that API (there is no Supabase client anywhere in the
 * codebase; everything goes through TypeORM), which makes PostgREST an unused door onto
 * tables like `payment_sessions`, `security_events` and `link_clicks`. With RLS off, that
 * door is wide open; with RLS on and no policies defined, it denies everything.
 *
 * This does NOT affect the application. A table's OWNER bypasses row security unless the
 * table is switched to FORCE ROW LEVEL SECURITY, which we deliberately do not do — the
 * backend connects as the role that created these tables, so its queries are unchanged.
 * To keep that guarantee airtight the loop only touches tables the current role owns; a
 * table owned by someone else is skipped rather than risk locking the app out of it.
 *
 * NOTE: tables created after this migration do not inherit RLS. New tables need the same
 * ALTER in their own migration.
 */
export class EnableRowLevelSecurity1790900000000 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tableowner = current_user
        LOOP
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tableowner = current_user
        LOOP
          EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
        END LOOP;
      END $$;
    `);
  }
}
