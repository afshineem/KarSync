const fs = require('fs');
const file = 'src/utils/settlementCalculations.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /if \(paymentBudget >= pay - 0\.001\) \{/g,
  `const isCovered = (pay > 0 && paymentBudget >= pay - 0.001) || (pay === 0 && Boolean(l.settlementReceiptId));
    if (isCovered) {`
);

fs.writeFileSync(file, content, 'utf8');
