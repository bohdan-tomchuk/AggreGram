import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrefetchOnCreateToFeeds1771872775589 implements MigrationInterface {
    name = 'AddPrefetchOnCreateToFeeds1771872775589'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_telegram_connections_restoration"`);
        await queryRunner.query(`ALTER TABLE "feeds" ADD "prefetch_on_create" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feeds" DROP COLUMN "prefetch_on_create"`);
        await queryRunner.query(`CREATE INDEX "idx_telegram_connections_restoration" ON "telegram_connections" ("user_id", "restoration_state") WHERE (session_status = 'active'::telegram_connections_session_status_enum)`);
    }

}
