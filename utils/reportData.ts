/**
 * Report data generators for ABDC Asset Management
 * Includes yearly aggregation with opening/closing balances
 */

import { Asset } from "@/types";
import { calculateDepreciationSchedule, calculateMonthlyDepreciationSchedule } from "./depreciation";

export interface YearlyScheduleRow {
  fiscalYear: number;
  category?: string;
  openingBalance: number;
  additions: number;
  disposals: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  closingNBV: number;
  closingOpening: number; // next year's opening
}

export interface FullyDepreciatedAsset {
  productId: string;
  name: string;
  category: string;
  originalCost: number;
  accumulatedDepreciation: number;
  salvageValue: number;
  nbvAtEnd: number;
  fullyDepreciatedDate: string;
  registrationDate: string;
}

/**
 * Get schedule for an asset
 */
function getAssetSchedule(asset: Asset) {
  return calculateDepreciationSchedule({
    acquisition_cost: asset.acquisitionCost,
    registration_date: asset.registrationDate || asset.acquisitionDate,
    useful_life: asset.usefulLife || 5,
    salvage_value: asset.salvageValue || 0,
    method: (asset.method as any) || "STRAIGHT_LINE",
  });
}

/**
 * Get NBV at start of fiscal year for an asset (i.e. NBV at end of prior year)
 */
function getOpeningNBV(asset: Asset, fiscalYear: number): number {
  const regYear = new Date(asset.registrationDate || asset.acquisitionDate).getFullYear();
  if (fiscalYear < regYear) return 0;
  if (fiscalYear === regYear) return 0; // New asset in this year - opening is 0, it's an addition
  return getClosingNBV(asset, fiscalYear - 1);
}

/**
 * Get NBV at end of fiscal year for an asset
 */
function getClosingNBV(asset: Asset, fiscalYear: number): number {
  const schedule = getAssetSchedule(asset);
  const regYear = new Date(asset.registrationDate || asset.acquisitionDate).getFullYear();
  if (fiscalYear < regYear) return 0;
  const entry = schedule.find((s) => s.fiscal_year === fiscalYear);
  if (entry) return entry.net_book_value;
  const lastEntry = schedule[schedule.length - 1];
  return fiscalYear > lastEntry.fiscal_year ? (asset.salvageValue || 0) : asset.acquisitionCost;
}

/**
 * Get depreciation expense for an asset in a fiscal year
 */
function getDepreciationForYear(asset: Asset, fiscalYear: number): number {
  const schedule = getAssetSchedule(asset);
  const entry = schedule.find((s) => s.fiscal_year === fiscalYear);
  return entry ? entry.depreciation_expense : 0;
}

/**
 * Get accumulated depreciation at end of fiscal year
 */
/**
 * Get accumulated depreciation at end of fiscal year
 */
function getAccumulatedDepreciation(asset: Asset, fiscalYear: number): number {
  const schedule = getAssetSchedule(asset);
  const entry = schedule.find((s) => s.fiscal_year === fiscalYear);
  if (entry) return entry.accumulated_depreciation;
  const lastEntry = schedule[schedule.length - 1];
  return fiscalYear > lastEntry.fiscal_year ? asset.acquisitionCost - (asset.salvageValue || 0) : 0;
}

/**
 * CACHE: Store monthly schedules to avoid re-calculating for every single cell
 */
const ASSET_MONTHLY_CACHE = new Map<string, MonthlyCache>();

export function clearAssetCache() {
  ASSET_MONTHLY_CACHE.clear();
}

interface MonthlyCache {
  get(key: string): { depr: number; accum: number; nbv: number } | undefined;
}

/**
 * Build a cache of monthly values for an asset (compute schedule once, index by year-month)
 */
/**
 * Build a cache of monthly values for an asset (compute schedule once, index by year-month)
 */
function getAssetMonthlyCache(asset: Asset): MonthlyCache {
  // Composite key to ensure cache invalidation on update
  const cacheKey = `${asset.id}-${asset.acquisitionCost}-${asset.registrationDate || ''}-${asset.usefulLife || ''}-${asset.salvageValue || 0}-${asset.method || ''}`;

  if (ASSET_MONTHLY_CACHE.has(cacheKey)) {
    return ASSET_MONTHLY_CACHE.get(cacheKey)!;
  }

  // Create a lightweight cache
  const schedule = calculateMonthlyDepreciationSchedule({
    acquisition_cost: asset.acquisitionCost,
    registration_date: asset.registrationDate || asset.acquisitionDate,
    useful_life: asset.usefulLife || 5,
    salvage_value: asset.salvageValue || 0,
    method: (asset.method as any) || "STRAIGHT_LINE",
  });

  const cacheMap = new Map<string, { depr: number; accum: number; nbv: number }>();
  for (const e of schedule) {
    const key = `${e.year}-${e.month}`;
    cacheMap.set(key, {
      depr: e.depreciation_expense,
      accum: e.accumulated_depreciation,
      nbv: e.net_book_value,
    });
  }

  ASSET_MONTHLY_CACHE.set(cacheKey, cacheMap);
  return cacheMap;
}

/**
 * Get Asset Values at a specific date (end of day)
 */
function getAssetValuesAtDate(asset: Asset, date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const key = `${year}-${month}`;

  const cache = getAssetMonthlyCache(asset);
  const entry = cache.get(key);

  // If before registration
  const regDate = new Date(asset.registrationDate || asset.acquisitionDate);
  if (date < regDate) {
    return { depr: 0, accum: 0, nbv: asset.acquisitionCost };
  }

  // If found exactly
  if (entry) return entry;

  // If not found (could be before start or after end)
  // If after end of useful life, return final values
  // We need to check if the date is AFTER the last schedule entry
  // But since we don't have the full schedule here easily without re-calc, 
  // we can infer: if it's not in cache but date is > regDate, it might be fully depreciated.
  // Let's re-use the full schedule calculation if needed, but the cache should cover useful life.
  // If year > last cached year, it's fully depreciated (or at salvage).

  // Optimization: Just return the last known value?
  // Let's assume calculateMonthlyDepreciationSchedule covers enough years (it usually does useful_life).
  // If date is beyond useful life, we return salvage value stats.

  const finalNBV = asset.salvageValue || 0;
  const finalAccum = asset.acquisitionCost - finalNBV;
  return { depr: 0, accum: finalAccum, nbv: finalNBV };
}

/**
 * Get values at the START of a period (which is End of Day of the previous day)
 */
function getAssetValuesAtStartOfPeriod(asset: Asset, startDate: Date) {
  // We want the closing values of the day BEFORE startDate
  const prevDay = new Date(startDate);
  prevDay.setDate(prevDay.getDate() - 1);
  return getAssetValuesAtDate(asset, prevDay);
}

/** Default forward projection years for bank-statement style perpetuity */
const PERPETUITY_YEARS = 30;

/**
 * Generate yearly Fixed Asset Schedule / Depreciation Schedule
 * Bank-statement style: opening carries forward to perpetuity even with no transactions
 */
export function generateYearlySchedule(
  assets: Asset[],
  startYear?: number,
  endYear?: number
): YearlyScheduleRow[] {
  const activeAssets = assets.filter((a) => a.status !== "Disposed" && a.conditionCode !== "F4");
  if (activeAssets.length === 0) return [];

  const regYears = activeAssets.map((a) =>
    new Date(a.registrationDate || a.acquisitionDate).getFullYear()
  );
  const currentYear = new Date().getFullYear();
  const minYear = startYear ?? Math.min(...regYears, currentYear - 10);
  const maxYear = endYear ?? currentYear + PERPETUITY_YEARS;
  const rows: YearlyScheduleRow[] = [];

  for (let fy = minYear; fy <= maxYear; fy++) {
    // Opening = sum of NBV at start of fy for assets that existed
    const openingBalance = activeAssets.reduce((sum, a) => sum + getOpeningNBV(a, fy), 0);

    const additions = activeAssets
      .filter((a) => new Date(a.registrationDate || a.acquisitionDate).getFullYear() === fy)
      .reduce((sum, a) => sum + a.acquisitionCost, 0);

    const disposals = 0; // Would need disposal tracking

    const depreciationExpense = activeAssets.reduce(
      (sum, a) => sum + getDepreciationForYear(a, fy),
      0
    );

    const closingNBV = activeAssets.reduce((sum, a) => sum + getClosingNBV(a, fy), 0);
    const accumulatedDepr = activeAssets.reduce(
      (sum, a) => sum + getAccumulatedDepreciation(a, fy),
      0
    );

    rows.push({
      fiscalYear: fy,
      openingBalance,
      additions,
      disposals,
      depreciationExpense,
      accumulatedDepreciation: accumulatedDepr,
      closingNBV,
      closingOpening: closingNBV,
    });
  }

  return rows;
}

/**
 * Generate yearly schedule broken down by category
 * Bank-statement style: opening carries forward to perpetuity even with no transactions
 */
export function generateYearlyScheduleByCategory(
  assets: Asset[],
  startYear?: number,
  endYear?: number
): YearlyScheduleRow[] {
  const activeAssets = assets.filter((a) => a.status !== "Disposed" && a.conditionCode !== "F4");
  if (activeAssets.length === 0) return [];

  const categories = [...new Set(activeAssets.map((a) => a.category || "Other"))].sort();
  const regYears = activeAssets.map((a) =>
    new Date(a.registrationDate || a.acquisitionDate).getFullYear()
  );
  const currentYear = new Date().getFullYear();
  const minYear = startYear ?? Math.min(...regYears, currentYear - 10);
  const maxYear = endYear ?? currentYear + PERPETUITY_YEARS;
  const rows: YearlyScheduleRow[] = [];

  for (const category of categories) {
    const categoryAssets = activeAssets.filter((a) => (a.category || "Other") === category);
    const categoryRegYears = categoryAssets.map((a) =>
      new Date(a.registrationDate || a.acquisitionDate).getFullYear()
    );
    const categoryMinYear = Math.min(...categoryRegYears, currentYear - 10);

    for (let fy = categoryMinYear; fy <= maxYear; fy++) {
      const openingBalance = categoryAssets.reduce((sum, a) => sum + getOpeningNBV(a, fy), 0);
      const additions = categoryAssets
        .filter((a) => new Date(a.registrationDate || a.acquisitionDate).getFullYear() === fy)
        .reduce((sum, a) => sum + a.acquisitionCost, 0);
      const disposals = 0;
      const depreciationExpense = categoryAssets.reduce(
        (sum, a) => sum + getDepreciationForYear(a, fy),
        0
      );
      const closingNBV = categoryAssets.reduce((sum, a) => sum + getClosingNBV(a, fy), 0);
      const accumulatedDepr = categoryAssets.reduce(
        (sum, a) => sum + getAccumulatedDepreciation(a, fy),
        0
      );

      rows.push({
        fiscalYear: fy,
        category,
        openingBalance,
        additions,
        disposals,
        depreciationExpense,
        accumulatedDepreciation: accumulatedDepr,
        closingNBV,
        closingOpening: closingNBV,
      });
    }
  }

  return rows.sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.fiscalYear - b.fiscalYear);
}

/**
 * Find fully depreciated assets (NBV reached salvage value)
 */
export function getFullyDepreciatedAssets(assets: Asset[]): FullyDepreciatedAsset[] {
  const result: FullyDepreciatedAsset[] = [];

  for (const asset of assets) {
    const schedule = getAssetSchedule(asset);
    if (schedule.length === 0) continue;

    const lastEntry = schedule[schedule.length - 1];
    const salvageVal = asset.salvageValue || 0;
    const isFullyDepreciated = lastEntry.net_book_value <= salvageVal + 0.01; // tolerance

    if (isFullyDepreciated) {
      result.push({
        productId: asset.productId,
        name: asset.name,
        category: asset.category,
        originalCost: asset.acquisitionCost,
        accumulatedDepreciation: lastEntry.accumulated_depreciation,
        salvageValue: salvageVal,
        nbvAtEnd: lastEntry.net_book_value,
        fullyDepreciatedDate: `${lastEntry.fiscal_year}-12-31`,
        registrationDate: asset.registrationDate || asset.acquisitionDate,
      });
    }
  }

  return result.sort((a, b) => b.fullyDepreciatedDate.localeCompare(a.fullyDepreciatedDate));
}

/**
 * Cost at start of period (for assets that existed)
 */
function getOpeningCost(asset: Asset, fiscalYear: number): number {
  const regYear = new Date(asset.registrationDate || asset.acquisitionDate).getFullYear();
  if (fiscalYear < regYear) return 0;
  if (fiscalYear === regYear) return 0; // New asset - in additions
  return asset.acquisitionCost;
}

/**
 * Cost at start of month (for assets that existed before this month)
 */
function getCostAtStartOfMonth(asset: Asset, year: number, month: number): number {
  const d = new Date(asset.registrationDate || asset.acquisitionDate);
  const regYear = d.getFullYear();
  const regMonth = d.getMonth() + 1;
  if (regYear < year) return asset.acquisitionCost;
  if (regYear === year && regMonth < month) return asset.acquisitionCost;
  return 0;
}

/**
 * Cost at end of period
 */
function getClosingCost(asset: Asset, fiscalYear: number): number {
  const regYear = new Date(asset.registrationDate || asset.acquisitionDate).getFullYear();
  if (fiscalYear < regYear) return 0;
  return asset.acquisitionCost; // Cost doesn't change unless disposals
}

/**
 * Get schedule for a single period in Cost/Valuation, Depreciation, NBV format
 * Matches bank-statement structure: Opening, Additions, Disposed, Closing (no fiscal year column)
 */
export interface PeriodScheduleRow {
  category: string;
  costOpening: number;
  costAdditions: number;
  costDisposed: number;
  costClosing: number;
  deprOpening: number;
  deprCharge: number;
  deprDisposed: number;
  deprClosing: number;
  nbvCurrent: number;
  nbvPrior: number;
}

export function generatePeriodScheduleByCategory(
  assets: Asset[],
  periodYear: number
): PeriodScheduleRow[] {
  const activeAssets = assets.filter((a) => a.status !== "Disposed" && a.conditionCode !== "F4");
  if (activeAssets.length === 0) return [];

  const categories = [...new Set(activeAssets.map((a) => a.category || "Other"))].sort();
  const rows: PeriodScheduleRow[] = [];
  const priorYear = periodYear - 1;

  for (const category of categories) {
    const categoryAssets = activeAssets.filter((a) => (a.category || "Other") === category);

    const costOpening = categoryAssets.reduce((sum, a) => sum + getOpeningCost(a, periodYear), 0);
    const costAdditions = categoryAssets
      .filter((a) => new Date(a.registrationDate || a.acquisitionDate).getFullYear() === periodYear)
      .reduce((sum, a) => sum + a.acquisitionCost, 0);
    const costDisposed = 0;
    const costClosing = costOpening + costAdditions - costDisposed;

    const deprOpening = categoryAssets.reduce(
      (sum, a) => sum + getAccumulatedDepreciation(a, priorYear),
      0
    );
    const deprCharge = categoryAssets.reduce(
      (sum, a) => sum + getDepreciationForYear(a, periodYear),
      0
    );
    const deprDisposed = 0;
    const deprClosing = deprOpening + deprCharge - deprDisposed;

    const nbvCurrent = categoryAssets.reduce((sum, a) => sum + getClosingNBV(a, periodYear), 0);
    const nbvPrior = categoryAssets.reduce((sum, a) => sum + getClosingNBV(a, priorYear), 0);

    rows.push({
      category,
      costOpening,
      costAdditions,
      costDisposed,
      costClosing,
      deprOpening,
      deprCharge,
      deprDisposed,
      deprClosing,
      nbvCurrent,
      nbvPrior,
    });
  }

  return rows;
}

/**
 * Monthly schedule row for a single month
 */
export interface MonthlyScheduleRow {
  category: string;
  costOpening: number;
  costAdditions: number;
  costDisposed: number;
  costClosing: number;
  deprOpening: number;
  deprCharge: number;
  deprDisposed: number;
  deprClosing: number;
  nbvCurrent: number;
  nbvPrior: number;
}



/**
 * Generate schedule for a CUSTOM DATE RANGE (Monthly, Quarterly, Custom)
 * Calculates Opening (at fromDate) and Closing (at toDate).
 */
export function generateCustomPeriodScheduleByCategory(
  assets: Asset[],
  fromDateStr: string,
  toDateStr: string
): PeriodScheduleRow[] {
  const activeAssets = assets.filter((a) => a.status !== "Disposed" && a.conditionCode !== "F4");
  if (activeAssets.length === 0) return [];

  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  // Ensure we include the full end date
  toDate.setHours(23, 59, 59, 999);

  const categories = [...new Set(activeAssets.map((a) => a.category || "Other"))].sort();
  const rows: PeriodScheduleRow[] = [];

  for (const category of categories) {
    const categoryAssets = activeAssets.filter((a) => (a.category || "Other") === category);

    let costOpening = 0;
    let costAdditions = 0;
    let costDisposed = 0;

    let deprOpening = 0;
    let deprCharge = 0; // The expense incurred DURING this period
    let deprDisposed = 0;

    // NBV is derived or summed? Best to sum individual asset NBVs for precision.
    let nbvCurrent = 0; // At toDate
    let nbvPrior = 0;   // At fromDate (Opening)

    for (const asset of categoryAssets) {
      const regDate = new Date(asset.registrationDate || asset.acquisitionDate);

      // 1. COST ANALYSIS
      // Opening Cost: If asset existed BEFORE fromDate
      if (regDate < fromDate) {
        costOpening += asset.acquisitionCost;
      }

      // Additions: If asset registered BETWEEN fromDate and toDate (inclusive)
      if (regDate >= fromDate && regDate <= toDate) {
        costAdditions += asset.acquisitionCost;
      }

      // Disposals: If disposal date combined check (not fully implemented in types yet, assuming simple logic)
      // if (asset.disposalDate && ...) costDisposed += ...


      // 2. DEPRECIATION ANALYSIS
      // We need:
      // - Accum Depr at start (fromDate)
      // - Accum Depr at end (toDate)
      // - Charge = End - Start

      const startValues = getAssetValuesAtStartOfPeriod(asset, fromDate);
      const endValues = getAssetValuesAtDate(asset, toDate);

      // Accum One-Day correction? 
      // Logic: 
      // Accum[Start] is Accum at End of Day (fromDate - 1).
      // Accum[End] is Accum at End of Day (toDate).
      // Charge = Accum[End] - Accum[Start].

      const assetDeprOpening = startValues.accum;
      const assetDeprClosing = endValues.accum;
      const assetDeprCharge = Math.max(0, assetDeprClosing - assetDeprOpening); // Should not be negative

      deprOpening += assetDeprOpening;
      deprCharge += assetDeprCharge;

      // 3. NBV ANALYSIS
      // Opening NBV = Cost Opening - Accum Opening?
      // Actually best to use the calculated schedule NBV.
      // But be careful: 
      // If asset is NEW (Addition), its Opening NBV is 0.
      // If asset existed, its Opening NBV is startValues.nbv.

      if (regDate < fromDate) {
        nbvPrior += startValues.nbv;
      } else {
        // It's an addition, so simplified Opening NBV is 0
        nbvPrior += 0;
      }

      // Closing NBV
      nbvCurrent += endValues.nbv;
    }

    const costClosing = costOpening + costAdditions - costDisposed;
    const deprClosing = deprOpening + deprCharge - deprDisposed;

    rows.push({
      category,
      costOpening,
      costAdditions,
      costDisposed,
      costClosing,
      deprOpening,
      deprCharge,
      deprDisposed,
      deprClosing,
      nbvCurrent,
      nbvPrior,
    });
  }

  return rows;
}

/**
 * Generate monthly schedule by category for a specific month/year.
 * Uses cached per-asset schedules to avoid recalculating (fixes freeze).
 */
export function generateMonthlyScheduleByCategory(
  assets: Asset[],
  year: number,
  month: number
): MonthlyScheduleRow[] {
  const activeAssets = assets.filter((a) => a.status !== "Disposed" && a.conditionCode !== "F4");
  if (activeAssets.length === 0) return [];

  const categories = [...new Set(activeAssets.map((a) => a.category || "Other"))].sort();
  const rows: MonthlyScheduleRow[] = [];

  for (const category of categories) {
    const categoryAssets = activeAssets.filter((a) => (a.category || "Other") === category);

    const costOpening = categoryAssets.reduce((sum, a) => sum + getCostAtStartOfMonth(a, year, month), 0);
    const regDateMatches = (a: Asset) => {
      const d = new Date(a.registrationDate || a.acquisitionDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    };
    const costAdditions = categoryAssets
      .filter(regDateMatches)
      .reduce((sum, a) => sum + a.acquisitionCost, 0);
    const costDisposed = 0;
    const costClosing = costOpening + costAdditions - costDisposed;

    let deprOpening = 0;
    let deprCharge = 0;
    let nbvCurrent = 0;
    let nbvPrior = 0;

    for (const a of categoryAssets) {
      const cache = getAssetMonthlyCache(a);
      const key = `${year}-${month}`;
      const priorKey = month === 1 ? `${year - 1}-12` : `${year}-${month - 1}`;
      const entry = cache.get(key);
      const priorEntry = cache.get(priorKey);
      deprOpening += priorEntry?.accum ?? 0;
      deprCharge += entry?.depr ?? 0;
      nbvCurrent += entry?.nbv ?? a.acquisitionCost;
      nbvPrior += priorEntry?.nbv ?? a.acquisitionCost;
    }

    const deprDisposed = 0;
    const deprClosing = deprOpening + deprCharge - deprDisposed;

    rows.push({
      category,
      costOpening,
      costAdditions,
      costDisposed,
      costClosing,
      deprOpening,
      deprCharge,
      deprDisposed,
      deprClosing,
      nbvCurrent,
      nbvPrior,
    });
  }

  return rows;
}

/**
 * Bank-statement style row: one per period, opening carries forward to next period
 */
export interface BankStatementRow {
  periodLabel: string;
  year: number;
  month: number;
  opening: number;
  additions: number;
  disposals: number;
  depreciation: number;
  closing: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generate bank-statement style report: consecutive periods with opening balance
 * carrying forward. Use fromDate/toDate to define the report period.
 * Opening of period N = Closing of period N-1.
 */
export function generateBankStatementSchedule(
  assets: Asset[],
  fromDate: string,
  toDate: string
): BankStatementRow[] {
  const activeAssets = assets.filter((a) => a.status !== "Disposed" && a.conditionCode !== "F4");
  if (activeAssets.length === 0) return [];

  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return [];

  const rows: BankStatementRow[] = [];
  const startYear = from.getFullYear();
  const startMonth = from.getMonth() + 1;
  const endYear = to.getFullYear();
  const endMonth = to.getMonth() + 1;

  let y = startYear;
  let m = startMonth;
  const maxMonths = 120;
  let count = 0;
  let runningClosing: number | null = null;

  while (count < maxMonths && (y < endYear || (y === endYear && m <= endMonth))) {
    const monthData = generateMonthlyScheduleByCategory(assets, y, m);
    const totals = monthData.reduce(
      (acc, r) => ({
        additions: acc.additions + r.costAdditions,
        disposals: acc.disposals + r.costDisposed,
        depreciation: acc.depreciation + r.deprCharge,
        closing: acc.closing + r.nbvCurrent,
        priorClosing: acc.priorClosing + r.nbvPrior,
      }),
      { additions: 0, disposals: 0, depreciation: 0, closing: 0, priorClosing: 0 }
    );

    const opening = runningClosing !== null ? runningClosing : totals.priorClosing;
    const closing = totals.closing;
    runningClosing = closing;

    rows.push({
      periodLabel: `${MONTH_NAMES[m - 1]} ${y}`,
      year: y,
      month: m,
      opening,
      additions: totals.additions,
      disposals: totals.disposals,
      depreciation: totals.depreciation,
      closing,
    });

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    count++;
  }

  return rows;
}
