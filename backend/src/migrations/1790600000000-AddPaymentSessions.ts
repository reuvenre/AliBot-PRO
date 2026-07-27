import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Checkout sessions for the payment flow. The amount is server-computed at creation and the
 * webhook confirms payment against this row (never a client price). external_ref is uniquely
 * indexed so a replayed/duplicated webhook can't apply a purchase twice.
 */
export class AddPaymentSessions1790600000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "payment_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" varchar NOT NULL,
        "kind" varchar NOT NULL DEFAULT 'subscription',
        "plan" varchar,
        "billing" varchar NOT NULL DEFAULT 'monthly',
        "pack_id" varchar,
        "amount" integer NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'ILS',
        "status" varchar NOT NULL DEFAULT 'pending',
        "external_ref" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "paid_at" TIMESTAMP,
        CONSTRAINT "PK_payment_sessions" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_sessions_external_ref" ON "payment_sessions" ("external_ref") WHERE "external_ref" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_payment_sessions_user" ON "payment_sessions" ("user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "payment_sessions"`);
  }
}
