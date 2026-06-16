-- Support active-record filters used by production API queries.
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "Asset_isActive_idx" ON "Asset"("isActive");
CREATE INDEX IF NOT EXISTS "TransferRequest_assetId_status_idx" ON "TransferRequest"("assetId", "status");

-- Enforce transfer actor integrity.
DO $$
BEGIN
  ALTER TABLE "TransferRequest"
    ADD CONSTRAINT "TransferRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TransferRequest"
    ADD CONSTRAINT "TransferRequest_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Prevent more than one pending transfer workflow for the same asset.
CREATE UNIQUE INDEX IF NOT EXISTS "TransferRequest_one_pending_per_asset_idx"
  ON "TransferRequest"("assetId")
  WHERE "status" = 'PENDING';
