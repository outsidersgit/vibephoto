ALTER TABLE "influencers"
  ALTER COLUMN "asaas_wallet_id" TYPE VARCHAR(36);

UPDATE "influencers"
SET "asaas_wallet_id" = TRIM("asaas_wallet_id")
WHERE "asaas_wallet_id" IS NOT NULL;

ALTER TABLE "influencers"
  ALTER COLUMN "asaas_wallet_id" SET NOT NULL;

ALTER TABLE "influencers"
  ADD CONSTRAINT "unique_influencers_codigo_cupom" UNIQUE ("codigo_cupom");

ALTER TABLE "influencers"
  ADD CONSTRAINT "unique_influencers_wallet" UNIQUE ("asaas_wallet_id");

CREATE INDEX IF NOT EXISTS "idx_influencers_codigo"
  ON "influencers" ("codigo_cupom");

CREATE INDEX IF NOT EXISTS "idx_influencers_wallet"
  ON "influencers" ("asaas_wallet_id");

