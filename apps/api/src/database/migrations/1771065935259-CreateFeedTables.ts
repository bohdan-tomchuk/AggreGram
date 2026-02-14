import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFeedTables1771065935259 implements MigrationInterface {
    name = 'CreateFeedTables1771065935259'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "source_channels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "telegram_channel_id" bigint NOT NULL, "username" character varying, "title" character varying NOT NULL, "description" text, "subscriber_count" integer, "avatar_url" character varying, "last_metadata_sync" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ecf82f294686075b5bc8f677755" UNIQUE ("telegram_channel_id"), CONSTRAINT "PK_1062b1d3c7c6bb1ee4d18fe30e0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "feed_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "feed_id" uuid NOT NULL, "source_channel_id" uuid NOT NULL, "last_message_id" bigint, "added_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_25b05eceabf666b3d833bfa54d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "feed_channels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "feed_id" uuid NOT NULL, "telegram_channel_id" bigint NOT NULL, "invite_link" character varying NOT NULL, "title" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7581f8d87e1d2cf4e9041019f25" UNIQUE ("feed_id"), CONSTRAINT "REL_7581f8d87e1d2cf4e9041019f2" UNIQUE ("feed_id"), CONSTRAINT "PK_52b3d2371e9819543540c45772a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."feeds_status_enum" AS ENUM('draft', 'active', 'paused', 'error')`);
        await queryRunner.query(`CREATE TABLE "feeds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "status" "public"."feeds_status_enum" NOT NULL DEFAULT 'draft', "polling_interval_sec" integer NOT NULL DEFAULT '300', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3dafbf766ecbb1eb2017732153f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "feed_sources" ADD CONSTRAINT "FK_cf7aa3f23e5439761111b4b54a3" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_sources" ADD CONSTRAINT "FK_50f1b014aeac1a6178e9ae8154b" FOREIGN KEY ("source_channel_id") REFERENCES "source_channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feed_channels" ADD CONSTRAINT "FK_7581f8d87e1d2cf4e9041019f25" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feeds" ADD CONSTRAINT "FK_ca81f22ea67d9df1257df35afb9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feeds" DROP CONSTRAINT "FK_ca81f22ea67d9df1257df35afb9"`);
        await queryRunner.query(`ALTER TABLE "feed_channels" DROP CONSTRAINT "FK_7581f8d87e1d2cf4e9041019f25"`);
        await queryRunner.query(`ALTER TABLE "feed_sources" DROP CONSTRAINT "FK_50f1b014aeac1a6178e9ae8154b"`);
        await queryRunner.query(`ALTER TABLE "feed_sources" DROP CONSTRAINT "FK_cf7aa3f23e5439761111b4b54a3"`);
        await queryRunner.query(`DROP TABLE "feeds"`);
        await queryRunner.query(`DROP TYPE "public"."feeds_status_enum"`);
        await queryRunner.query(`DROP TABLE "feed_channels"`);
        await queryRunner.query(`DROP TABLE "feed_sources"`);
        await queryRunner.query(`DROP TABLE "source_channels"`);
    }

}
