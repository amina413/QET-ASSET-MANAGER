-- Add a session version so password resets and other account security events
-- can revoke every existing stateless iron-session cookie for a user.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Existing transfer requests created before the application required a target
-- custodian may have NULL values. Backfill them to the requester so the column
-- can be made non-null; future application validation requires the real target.
UPDATE "TransferRequest"
SET "toCustodianId" = "requestedById"
WHERE "toCustodianId" IS NULL;

ALTER TABLE "TransferRequest"
  ALTER COLUMN "toCustodianId" SET NOT NULL;
