import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAggregationJobsTable1771075883484 implements MigrationInterface {
    name = 'CreateAggregationJobsTable1771075883484'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."aggregation_jobs_status_enum" AS ENUM('pending', 'running', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "aggregation_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "feed_id" uuid NOT NULL, "status" "public"."aggregation_jobs_status_enum" NOT NULL DEFAULT 'pending', "messages_fetched" integer NOT NULL DEFAULT '0', "messages_posted" integer NOT NULL DEFAULT '0', "error_message" text, "started_at" TIMESTAMP, "completed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9db99d440c7216bd0c6bac7356e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aggregation_jobs" ADD CONSTRAINT "FK_6f977dc742d7ae4a976116740a0" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aggregation_jobs" DROP CONSTRAINT "FK_6f977dc742d7ae4a976116740a0"`);
        await queryRunner.query(`DROP TABLE "aggregation_jobs"`);
        await queryRunner.query(`DROP TYPE "public"."aggregation_jobs_status_enum"`);
    }

}
