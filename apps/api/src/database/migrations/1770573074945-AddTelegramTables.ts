import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramTables1770573074945 implements MigrationInterface {
    name = 'AddTelegramTables1770573074945'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."telegram_connections_session_status_enum" AS ENUM('active', 'expired', 'revoked')`);
        await queryRunner.query(`CREATE TABLE "telegram_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "telegram_user_id" bigint, "phone_number" character varying, "session_status" "public"."telegram_connections_session_status_enum" NOT NULL DEFAULT 'active', "auth_step" character varying NOT NULL DEFAULT 'idle', "last_auth_method" character varying, "last_activity_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_eb1c8f3d7a809189d3d8bcfde56" UNIQUE ("user_id"), CONSTRAINT "PK_5dae37b82dbe4d515d02695fad9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_bots_status_enum" AS ENUM('creating', 'active', 'revoked', 'error')`);
        await queryRunner.query(`CREATE TABLE "user_bots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "bot_token" character varying NOT NULL, "bot_username" character varying NOT NULL, "bot_telegram_id" bigint NOT NULL, "status" "public"."user_bots_status_enum" NOT NULL DEFAULT 'creating', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b37324568a0b501b2216e04ca85" UNIQUE ("user_id"), CONSTRAINT "PK_a7b98ebbc184291f95f72910e3e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "telegram_connections" ADD CONSTRAINT "FK_eb1c8f3d7a809189d3d8bcfde56" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_bots" ADD CONSTRAINT "FK_b37324568a0b501b2216e04ca85" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_bots" DROP CONSTRAINT "FK_b37324568a0b501b2216e04ca85"`);
        await queryRunner.query(`ALTER TABLE "telegram_connections" DROP CONSTRAINT "FK_eb1c8f3d7a809189d3d8bcfde56"`);
        await queryRunner.query(`DROP TABLE "user_bots"`);
        await queryRunner.query(`DROP TYPE "public"."user_bots_status_enum"`);
        await queryRunner.query(`DROP TABLE "telegram_connections"`);
        await queryRunner.query(`DROP TYPE "public"."telegram_connections_session_status_enum"`);
    }

}
