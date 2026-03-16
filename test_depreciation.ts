
import { calculateDepreciationSchedule, DepreciationMethod } from './utils/depreciation';

const testInput = {
    acquisition_cost: 10000,
    registration_date: '2024-10-01',
    useful_life: 5,
    salvage_value: 1000,
    method: DepreciationMethod.REDUCING_BALANCE
};

console.log("--- ABDC Depreciation Test ---");
console.log("Input:", JSON.stringify(testInput, null, 2));

const schedule = calculateDepreciationSchedule(testInput);

console.log("\nSchedule Results:");
console.table(schedule);

const year1 = schedule[0];
console.log(`\nValidation:`);
console.log(`Year 1 Expense: ${year1.depreciation_expense}`);
console.log(`Expected (roughly): 10000 * (2/5) * (92/365) = 1008.22`);

const finalYear = schedule[schedule.length - 1];
console.log(`Final NBV: ${finalYear.net_book_value}`);
console.log(`Expected Salvage: 1000`);

if (finalYear.net_book_value === 1000) {
    console.log("\n✅ SUCCESS: Final NBV matches salvage value exactly.");
} else {
    console.log("\n❌ FAILURE: Final NBV drift detected.");
}

if (year1.depreciation_expense > 1000 && year1.depreciation_expense < 1010) {
    console.log("✅ SUCCESS: Pro-rata Year 1 (3 months) calculated correctly.");
} else {
    console.log(`❌ FAILURE: Year 1 expense ${year1.depreciation_expense} seems incorrect.`);
}
