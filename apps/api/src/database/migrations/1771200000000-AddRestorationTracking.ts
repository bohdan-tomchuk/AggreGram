import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestorationTracking1771200000000 implements MigrationInterface {
  name = 'AddRestorationTracking1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for restoration_state
    await queryRunner.query(
      `CREATE TYPE "public"."telegram_connections_restoration_state_enum" AS ENUM('pending', 'in_progress', 'failed')`,
    );

    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "telegram_connections"
       ADD COLUMN "restoration_state" "public"."telegram_connections_restoration_state_enum",
       ADD COLUMN "last_restoration_attempt_at" TIMESTAMP,
       ADD COLUMN "restoration_failure_count" INTEGER NOT NULL DEFAULT 0`,
    );

    // Create index for efficient querying of active sessions with restoration state
    await queryRunner.query(
      `CREATE INDEX "idx_telegram_connections_restoration"
       ON "telegram_connections"("user_id", "restoration_state")
       WHERE "session_status" = 'active'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_telegram_connections_restoration"`,
    );

    // Drop columns
    await queryRunner.query(
      `ALTER TABLE "telegram_connections"
       DROP COLUMN "restoration_state",
       DROP COLUMN "last_restoration_attempt_at",
       DROP COLUMN "restoration_failure_count"`,
    );

    // Drop enum type
    await queryRunner.query(
      `DROP TYPE "public"."telegram_connections_restoration_state_enum"`,
    );
  }
}
