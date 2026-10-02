import { formatAmount, normalizeDigits } from './src/utils/formatters.js';

let amount = "973500";
console.log("Initial format:", formatAmount(amount));

// Simulating typing "1"
let e_target_value = formatAmount(amount) + "1";
amount = normalizeDigits(e_target_value).replace(/,/g, '');
console.log("After typing 1:", amount, "->", formatAmount(amount));

// Simulating deleting
e_target_value = "";
amount = normalizeDigits(e_target_value).replace(/,/g, '');
console.log("After delete:", amount, "->", formatAmount(amount));
