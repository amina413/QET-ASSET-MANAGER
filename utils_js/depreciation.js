/**
 * QET Asset Management - high-precision depreciation service
 */
export var DepreciationMethod;
(function (DepreciationMethod) {
    DepreciationMethod["STRAIGHT_LINE"] = "STRAIGHT_LINE";
    DepreciationMethod["REDUCING_BALANCE"] = "REDUCING_BALANCE";
    DepreciationMethod["SUM_OF_YEARS"] = "SUM_OF_YEARS";
})(DepreciationMethod || (DepreciationMethod = {}));
/**
 * High precision rounding - Round Half-Up to 2 decimals
 */
export const roundHalfUp = (num, decimals = 2) => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor + Number.EPSILON) / factor;
};
/**
 * Calculate the number of days between two dates
 */
const getDaysBetween = (start, end) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
/**
 * QET Backend Calculation Engine
 */
export const calculateDepreciationSchedule = (input) => {
    const { acquisition_cost, acquisition_date, useful_life, salvage_value, method } = input;
    const schedule = [];
    const acqDate = new Date(acquisition_date);
    const startYear = acqDate.getFullYear();
    let currentBookValue = acquisition_cost;
    let accumulatedDepreciation = 0;
    let remainingUsefulLifeDays = useful_life * 365; // Simplified for day-count logic
    // Total depreciable amount
    const depreciableAmount = acquisition_cost - salvage_value;
    // 1. Calculate Period 1 (Pro-rata for the first fiscal year)
    const endOfFirstYear = new Date(startYear, 11, 31);
    const daysInFirstYear = getDaysBetween(acqDate, endOfFirstYear) + 1; // Include the acquisition day
    const year1ProRataFactor = daysInFirstYear / 365;
    let year = 1;
    let currentFiscalYear = startYear;
    // Helpers for methods
    const getAnnualRate = () => {
        switch (method) {
            case DepreciationMethod.STRAIGHT_LINE:
                return 1 / useful_life;
            case DepreciationMethod.REDUCING_BALANCE:
                return 2 / useful_life;
            default:
                return 0;
        }
    };
    const SYD_Sum = (useful_life * (useful_life + 1)) / 2;
    while (currentBookValue > salvage_value && year <= useful_life + 1) {
        let depreciationExpense = 0;
        if (year === 1) {
            // Pro-rata first year
            if (method === DepreciationMethod.STRAIGHT_LINE) {
                depreciationExpense = (depreciableAmount / useful_life) * year1ProRataFactor;
            }
            else if (method === DepreciationMethod.REDUCING_BALANCE) {
                depreciationExpense = (currentBookValue * (2 / useful_life)) * year1ProRataFactor;
            }
            else if (method === DepreciationMethod.SUM_OF_YEARS) {
                depreciationExpense = (depreciableAmount * (useful_life / SYD_Sum)) * year1ProRataFactor;
            }
        }
        else {
            // Determine if we are in the "tail" or full middle years
            // Actual/365 means we finish exactly 'useful_life' years from acquisition
            const totalDaysElapsed = ((year - 2) * 365) + daysInFirstYear;
            const remainingDays = (useful_life * 365) - totalDaysElapsed;
            if (remainingDays <= 0)
                break;
            if (remainingDays < 365) {
                // FINAL YEAR SNAP - Ensure we hit exactly the salvage value
                depreciationExpense = currentBookValue - salvage_value;
            }
            else {
                // Middle years
                if (method === DepreciationMethod.STRAIGHT_LINE) {
                    depreciationExpense = depreciableAmount / useful_life;
                }
                else if (method === DepreciationMethod.REDUCING_BALANCE) {
                    depreciationExpense = currentBookValue * (2 / useful_life);
                }
                else if (method === DepreciationMethod.SUM_OF_YEARS) {
                    // SYD is tricky with pro-rata. We take weighted parts of SYD years.
                    // For simplicity, we use the current SYD factor for the year.
                    const sydYear = year - 1 + year1ProRataFactor;
                    const remainingSydLife = useful_life - (year - 2) - year1ProRataFactor;
                    depreciationExpense = depreciableAmount * (remainingSydLife / SYD_Sum);
                }
            }
        }
        // Constraints & Snipping
        // Do not allow book value to drop below salvage
        if (currentBookValue - depreciationExpense < salvage_value) {
            depreciationExpense = currentBookValue - salvage_value;
        }
        // Final Year Snap Rule: Ensure exactly salvage value at the end of life
        if (year > useful_life) {
            depreciationExpense = currentBookValue - salvage_value;
        }
        depreciationExpense = roundHalfUp(depreciationExpense);
        accumulatedDepreciation = roundHalfUp(accumulatedDepreciation + depreciationExpense);
        currentBookValue = roundHalfUp(currentBookValue - depreciationExpense);
        schedule.push({
            year,
            fiscal_year: currentFiscalYear,
            depreciation_expense: depreciationExpense,
            accumulated_depreciation: accumulatedDepreciation,
            net_book_value: currentBookValue
        });
        if (currentBookValue <= salvage_value)
            break;
        year++;
        currentFiscalYear++;
    }
    return schedule;
};
