import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplacePrefetchWithFetchFromDate1772000000000 implements MigrationInterface {
    name = 'ReplacePrefetchWithFetchFromDate1772000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feeds" DROP COLUMN "prefetch_on_create"`);
        await queryRunner.query(`ALTER TABLE "feeds" ADD "fetch_from_date" TIMESTAMP NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feeds" DROP COLUMN "fetch_from_date"`);
        await queryRunner.query(`ALTER TABLE "feeds" ADD "prefetch_on_create" boolean NOT NULL DEFAULT false`);
    }
}
