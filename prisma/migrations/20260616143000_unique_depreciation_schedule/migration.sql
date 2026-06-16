-- Ensure each asset has at most one depreciation schedule row per fiscal year.
CREATE UNIQUE INDEX IF NOT EXISTS "DepreciationSchedule_assetId_fiscalYear_key"
  ON "DepreciationSchedule"("assetId", "fiscalYear");
