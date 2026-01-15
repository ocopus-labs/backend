-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "description" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'restaurant';

-- CreateIndex
CREATE INDEX "restaurants_type_idx" ON "restaurants"("type");
