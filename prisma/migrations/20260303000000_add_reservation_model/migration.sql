-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "table_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "party_size" INTEGER NOT NULL,
    "reservation_date" TEXT NOT NULL,
    "reservation_time" TEXT NOT NULL,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "special_requests" TEXT,
    "source" TEXT DEFAULT 'manual',
    "created_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "seated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_reservation_date_idx" ON "reservations"("restaurant_id", "reservation_date");

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_status_idx" ON "reservations"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "reservations_restaurant_id_reservation_date_status_idx" ON "reservations"("restaurant_id", "reservation_date", "status");

-- CreateIndex
CREATE INDEX "reservations_table_id_idx" ON "reservations"("table_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_created_at_idx" ON "reservations"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Drop old Json reservations column from tables
ALTER TABLE "tables" DROP COLUMN IF EXISTS "reservations";
