import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1732992000000 implements MigrationInterface {
  name = 'InitialSchema1732992000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying,
        "role" character varying NOT NULL DEFAULT 'user',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_role" CHECK ("role" IN ('admin', 'user'))
      )
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "is_revoked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id")
      )
    `);

    // Create index on refresh_tokens.token_hash
    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")
    `);

    // Add foreign key for refresh_tokens.user_id
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD CONSTRAINT "FK_refresh_tokens_user_id"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE
    `);

    // Create channels table
    await queryRunner.query(`
      CREATE TABLE "channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "telegram_id" bigint NOT NULL,
        "username" character varying,
        "title" character varying NOT NULL,
        "description" text,
        "subscriber_count" integer,
        "photo_url" character varying,
        "topic" character varying NOT NULL,
        "channel_type" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_crawled_at" TIMESTAMP,
        "last_post_id" bigint,
        "crawl_priority" integer NOT NULL DEFAULT 5,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_channels_telegram_id" UNIQUE ("telegram_id"),
        CONSTRAINT "UQ_channels_username" UNIQUE ("username"),
        CONSTRAINT "PK_channels_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_channels_channel_type" CHECK ("channel_type" IN ('news', 'personal_blog', 'official'))
      )
    `);

    // Create indexes on channels
    await queryRunner.query(`
      CREATE INDEX "IDX_channels_telegram_id" ON "channels" ("telegram_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_channels_username" ON "channels" ("username")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_channels_topic" ON "channels" ("topic")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_channels_is_active" ON "channels" ("is_active")
    `);

    // Create posts table
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "telegram_post_id" bigint NOT NULL,
        "text_content" text,
        "has_media" boolean NOT NULL DEFAULT false,
        "media_type" character varying,
        "media_file_id" character varying,
        "media_thumbnail" character varying,
        "views" integer,
        "forwards" integer,
        "posted_at" TIMESTAMP NOT NULL,
        "is_edited" boolean NOT NULL DEFAULT false,
        "edited_at" TIMESTAMP,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "deleted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_posts_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_posts_media_type" CHECK ("media_type" IN ('photo', 'video', 'document'))
      )
    `);

    // Create indexes on posts
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_telegram_post_id" ON "posts" ("telegram_post_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_posted_at" ON "posts" ("posted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_channel_id_posted_at" ON "posts" ("channel_id", "posted_at")
    `);

    // Add foreign key for posts.channel_id
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD CONSTRAINT "FK_posts_channel_id"
      FOREIGN KEY ("channel_id")
      REFERENCES "channels"("id")
      ON DELETE CASCADE
    `);

    // Add full-text search column and trigger
    await queryRunner.query(`
      ALTER TABLE "posts" ADD COLUMN "search_vector" tsvector
    `);

    await queryRunner.query(`
      CREATE INDEX "post_search_idx" ON "posts" USING gin("search_vector")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', COALESCE(NEW.text_content, ''));
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER posts_search_vector_update_trigger
      BEFORE INSERT OR UPDATE ON "posts"
      FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop full-text search trigger and function
    await queryRunner.query(`DROP TRIGGER IF EXISTS posts_search_vector_update_trigger ON "posts"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS posts_search_vector_update()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "post_search_idx"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "search_vector"`);

    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "FK_posts_channel_id"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "FK_refresh_tokens_user_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
