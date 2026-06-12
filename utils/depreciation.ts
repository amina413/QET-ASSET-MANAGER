
/**
 * QET Asset Management - high-precision depreciation service
 */

export enum DepreciationMethod {
    STRAIGHT_LINE = 'STRAIGHT_LINE',
    REDUCING_BALANCE = 'REDUCING_BALANCE',
    SUM_OF_YEARS = 'SUM_OF_YEARS'
}

export interface DepreciationInput {
    acquisition_cost: number;
    acquisition_date?: string; // ISO format or YYYY-MM-DD (optional, kept for backward compatibility)
    registration_date: string | Date; // ISO format or YYYY-MM-DD - used for depreciation calculation
    useful_life: number;
    salvage_value: number;
    method: DepreciationMethod;
}

export interface DepreciationYear {
    year: number;
    fiscal_year: number;
    depreciation_expense: number;
    accumulated_depreciation: number;
    net_book_value: number;
}

/**
 * High precision rounding - Round Half-Up to 2 decimals
 */
export const roundHalfUp = (num: number, decimals: number = 2): number => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor + Number.EPSILON) / factor;
};

/**
 * Calculate the number of days between two dates
 */
const getDaysBetween = (start: Date, end: Date): number => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * QET Backend Calculation Engine
 */
export const calculateDepreciationSchedule = (input: DepreciationInput): DepreciationYear[] => {
    const { acquisition_cost, registration_date, useful_life, salvage_value, method } = input;

    const schedule: DepreciationYear[] = [];
    
    // Parse and validate the registration date (used for depreciation calculation)
    let regDate = registration_date instanceof Date ? registration_date : new Date(registration_date);
    if (isNaN(regDate.getTime()) || regDate.getFullYear() < 1900 || regDate.getFullYear() > 2100) {
        console.warn(`Invalid registration date: ${registration_date}, using current date`);
        regDate = new Date();
    }
    
    const startYear = regDate.getFullYear();

    let currentBookValue = acquisition_cost;
    let accumulatedDepreciation = 0;
    let remainingUsefulLifeDays = useful_life * 365; // Simplified for day-count logic

    // Total depreciable amount
    const depreciableAmount = acquisition_cost - salvage_value;

    // 1. Calculate Period 1 (Pro-rata for the first fiscal year)
    const endOfFirstYear = new Date(startYear, 11, 31);
    const daysInFirstYear = getDaysBetween(regDate, endOfFirstYear) + 1; // Include the registration day
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
            } else if (method === DepreciationMethod.REDUCING_BALANCE) {
                depreciationExpense = (currentBookValue * (2 / useful_life)) * year1ProRataFactor;
            } else if (method === DepreciationMethod.SUM_OF_YEARS) {
                depreciationExpense = (depreciableAmount * (useful_life / SYD_Sum)) * year1ProRataFactor;
            }
        } else {
            // Determine if we are in the "tail" or full middle years
            // Actual/365 means we finish exactly 'useful_life' years from registration
            const totalDaysElapsed = ((year - 2) * 365) + daysInFirstYear;
            const remainingDays = (useful_life * 365) - totalDaysElapsed;

            if (remainingDays <= 0) break;

            if (remainingDays < 365) {
                // FINAL YEAR SNAP - Ensure we hit exactly the salvage value
                depreciationExpense = currentBookValue - salvage_value;
            } else {
                // Middle years
                if (method === DepreciationMethod.STRAIGHT_LINE) {
                    depreciationExpense = depreciableAmount / useful_life;
                } else if (method === DepreciationMethod.REDUCING_BALANCE) {
                    depreciationExpense = currentBookValue * (2 / useful_life);
                } else if (method === DepreciationMethod.SUM_OF_YEARS) {
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

        if (currentBookValue <= salvage_value) break;

        year++;
        currentFiscalYear++;
    }

    return schedule;
};

export interface DepreciationMonth {
    month: number;
    year: number;
    month_label: string; // "Jan", "Feb"
    fiscal_year_label: string; // "FY 2025"
    depreciation_expense: number;
    accumulated_depreciation: number;
    net_book_value: number;
}

export const calculateMonthlyDepreciationSchedule = (input: DepreciationInput): DepreciationMonth[] => {
    const { acquisition_cost, registration_date, useful_life, salvage_value, method } = input;
    const schedule: DepreciationMonth[] = [];

    let currentBookValue = acquisition_cost;
    let accumulatedDepreciation = 0;

    // Parse and validate registration date
    let regDate = registration_date instanceof Date ? registration_date : new Date(registration_date);
    if (isNaN(regDate.getTime()) || regDate.getFullYear() < 1900 || regDate.getFullYear() > 2100) {
        console.warn(`Invalid registration date: ${registration_date}, using current date`);
        regDate = new Date();
    }
    const startDate = new Date(regDate);
    const totalMonths = useful_life * 12;
    const depreciableAmount = acquisition_cost - salvage_value;

    // Monthly Rate Estimation
    // Note: For high precision, we should strictly follow the Annual Schedule's daily logic and allocate to months.
    // Ideally: Calculate Annual, then split. But for "Monthly View", a smoother curve is often preferred.
    // We will use a standard monthly rate derived from the method.

    for (let i = 0; i <= totalMonths; i++) {
        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + i);

        let monthlyExpense = 0;

        if (i === 0) {
            // Month 0 (Registration Month) - Pro-rata days
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const registrationDay = currentDate.getDate();
            const daysActive = daysInMonth - registrationDay + 1;

            // Base Annual Expense for Year 1 (Approx)
            let baseAnnual = 0;
            if (method === DepreciationMethod.STRAIGHT_LINE) baseAnnual = depreciableAmount / useful_life;
            // For others, we simplify to S.L. or simple rate for the first partial month to avoid extreme complexity in JS
            else if (method === DepreciationMethod.REDUCING_BALANCE) baseAnnual = currentBookValue * (2 / useful_life);
            else if (method === DepreciationMethod.SUM_OF_YEARS) baseAnnual = depreciableAmount * (useful_life / ((useful_life * (useful_life + 1)) / 2));

            monthlyExpense = (baseAnnual / 12) * (daysActive / 30); // Approx pro-rata
        } else {
            // Full Months
            if (method === DepreciationMethod.STRAIGHT_LINE) {
                monthlyExpense = (depreciableAmount / useful_life) / 12;
            } else if (method === DepreciationMethod.REDUCING_BALANCE) {
                // Monthly RB is effectively (Book Value * Rate) / 12
                monthlyExpense = (currentBookValue * (2 / useful_life)) / 12;
            } else if (method === DepreciationMethod.SUM_OF_YEARS) {
                // SYD Monthly is complex. We will approximate by taking the current year's annual SYD and dividing by 12.
                // Determine "Year of Asset Life"
                const assetYearForMonth = Math.floor((i - 1) / 12) + 1;
                const SYD_Sum = (useful_life * (useful_life + 1)) / 2;
                const remainingLife = useful_life - assetYearForMonth + 1;
                const annualSYD = depreciableAmount * (remainingLife / SYD_Sum);
                monthlyExpense = annualSYD / 12;
            }
        }

        // Cap at salvage
        if (currentBookValue - monthlyExpense < salvage_value) {
            monthlyExpense = currentBookValue - salvage_value;
        }
        if (currentBookValue <= salvage_value) monthlyExpense = 0;

        monthlyExpense = roundHalfUp(monthlyExpense);
        accumulatedDepreciation = roundHalfUp(accumulatedDepreciation + monthlyExpense);
        currentBookValue = roundHalfUp(currentBookValue - monthlyExpense);

        schedule.push({
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            month_label: currentDate.toLocaleString('default', { month: 'short' }),
            fiscal_year_label: `FY ${currentDate.getFullYear()}`,
            depreciation_expense: monthlyExpense,
            accumulated_depreciation: accumulatedDepreciation,
            net_book_value: currentBookValue
        });

        if (currentBookValue <= salvage_value && i > 0) break;
    }

    return schedule;
};
