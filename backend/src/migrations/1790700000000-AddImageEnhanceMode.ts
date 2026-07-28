import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * image_enhance_mode: 'studio' (local sharp pass — the existing behaviour) or 'ai'
 * (Gemini image model / "Nano Banana" redesign using the user's own Gemini key).
 */
export class AddImageEnhanceMode1790700000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "image_enhance_mode" varchar NOT NULL DEFAULT 'studio'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "image_enhance_mode"`);
  }
}
