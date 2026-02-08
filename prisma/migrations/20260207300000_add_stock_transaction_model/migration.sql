-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "previous_stock" DECIMAL(10,3) NOT NULL,
    "new_stock" DECIMAL(10,3) NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "performed_by" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_transactions_inventory_item_id_performed_at_idx" ON "stock_transactions"("inventory_item_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "stock_transactions_restaurant_id_idx" ON "stock_transactions"("restaurant_id");

-- CreateIndex
CREATE INDEX "stock_transactions_type_idx" ON "stock_transactions"("type");

-- CreateIndex
CREATE INDEX "stock_transactions_performed_at_idx" ON "stock_transactions"("performed_at" DESC);

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
