const fs = require('fs');
const file = 'src/services/realtimeSync.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /wageType: w\.wageType \|\| 'standard',\n\s*wageType: w\.wageType \|\| 'standard',/g,
  `wageType: w.wageType || 'standard',`
);

fs.writeFileSync(file, content, 'utf8');
