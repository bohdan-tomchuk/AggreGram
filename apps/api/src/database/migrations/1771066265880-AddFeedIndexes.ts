import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedIndexes1771066265880 implements MigrationInterface {
    name = 'AddFeedIndexes1771066265880'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_cf7aa3f23e5439761111b4b54a" ON "feed_sources" ("feed_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f2597eb905242c015ead11f64" ON "feeds" ("user_id", "status") `);
        await queryRunner.query(`ALTER TABLE "feed_sources" ADD CONSTRAINT "UQ_9b2eccc8ea80879a57d22ef2da3" UNIQUE ("feed_id", "source_channel_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feed_sources" DROP CONSTRAINT "UQ_9b2eccc8ea80879a57d22ef2da3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8f2597eb905242c015ead11f64"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf7aa3f23e5439761111b4b54a"`);
    }

}
