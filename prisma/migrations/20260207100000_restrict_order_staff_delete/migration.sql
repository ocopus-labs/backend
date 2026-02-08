-- AlterTable: Change Order.staffId foreign key from default (Cascade/SetNull) to Restrict
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_staff_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
