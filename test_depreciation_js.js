
// ESM JS file for testing
import { calculateDepreciationSchedule, DepreciationMethod } from './utils_js/depreciation.js';

const testInput = {
    acquisition_cost: 10000,
    acquisition_date: '2024-10-01',
    useful_life: 5,
    salvage_value: 1000,
    method: DepreciationMethod.REDUCING_BALANCE
};

console.log("--- QET Depreciation Test ---");
const schedule = calculateDepreciationSchedule(testInput);

console.log("\nSchedule Results:");
console.table(schedule);

const year1 = schedule[0];
console.log(`\nValidation:`);
console.log(`Year 1 Expense: ${year1.depreciation_expense}`);

const finalYear = schedule[schedule.length - 1];
console.log(`Final NBV: ${finalYear.net_book_value}`);

if (finalYear.net_book_value === 1000) {
    console.log("\n✅ SUCCESS: Final NBV matches salvage value.");
} else {
    console.log("\n❌ FAILURE: Final NBV drift.");
}

if (year1.depreciation_expense > 1000 && year1.depreciation_expense < 1010) {
    console.log("✅ SUCCESS: Year 1 pro-rata (3 months) correct.");
} else {
    console.log(`❌ FAILURE: Year 1 expense ${year1.depreciation_expense} incorrect.`);
}
