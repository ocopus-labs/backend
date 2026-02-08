-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_prefix_key" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_restaurant_id_idx" ON "api_keys"("restaurant_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
