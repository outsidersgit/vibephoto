-- AddColumn
ALTER TABLE "payments" ADD COLUMN "coupon_code_used" TEXT;
ALTER TABLE "payments" ADD COLUMN "discount_applied" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "payments_coupon_code_used_idx" ON "payments"("coupon_code_used");
