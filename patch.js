const fs = require('fs');
const file = 'src/components/accounting/GeneralLedgerTable.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /value=\{formatAmount\(amount\)\}\s*onChange=\{\(e\) => setAmount\(normalizeDigits\(e\.target\.value\)\.replace\(\/\,\/g\, ''\)\)\}/g,
  `value={amount === '' ? '' : formatNumber(amount)}
              onChange={(e) => {
                const val = normalizeDigits(e.target.value).replace(/,/g, '');
                if (val === '') setAmount('');
                else if (!isNaN(val)) setAmount(val);
              }}`
);

fs.writeFileSync(file, content, 'utf8');
