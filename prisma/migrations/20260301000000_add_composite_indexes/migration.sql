-- CreateIndex
CREATE INDEX "business_users_user_id_restaurant_id_status_idx" ON "business_users"("user_id", "restaurant_id", "status");

-- CreateIndex
CREATE INDEX "payments_restaurant_id_status_idx" ON "payments"("restaurant_id", "status");
