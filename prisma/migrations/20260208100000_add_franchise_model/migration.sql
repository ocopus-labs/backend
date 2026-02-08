-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "configSource" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "franchise_id" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "franchise_id" TEXT;

-- CreateTable
CREATE TABLE "franchises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "menu_template" JSONB,
    "branding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise_users" (
    "id" TEXT NOT NULL,
    "franchise_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "franchises_slug_key" ON "franchises"("slug");

-- CreateIndex
CREATE INDEX "franchises_owner_id_idx" ON "franchises"("owner_id");

-- CreateIndex
CREATE INDEX "franchises_slug_idx" ON "franchises"("slug");

-- CreateIndex
CREATE INDEX "franchises_status_idx" ON "franchises"("status");

-- CreateIndex
CREATE INDEX "franchise_users_franchise_id_idx" ON "franchise_users"("franchise_id");

-- CreateIndex
CREATE INDEX "franchise_users_user_id_idx" ON "franchise_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "franchise_users_franchise_id_user_id_key" ON "franchise_users"("franchise_id", "user_id");

-- CreateIndex
CREATE INDEX "restaurants_franchise_id_idx" ON "restaurants"("franchise_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_franchise_id_key" ON "subscriptions"("franchise_id");

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_users" ADD CONSTRAINT "franchise_users_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_users" ADD CONSTRAINT "franchise_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
