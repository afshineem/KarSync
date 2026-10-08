const fs = require('fs');
const file = 'src/services/realtimeSync.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /teamRole: w\.team_role \|\| w\.teamRole \|\| localW\?\.teamRole \|\| 'Worker',/g,
  `teamRole: w.team_role || w.teamRole || localW?.teamRole || 'Worker',\n            wageType: w.wageType || localW?.wageType || 'standard',`
);

fs.writeFileSync(file, content, 'utf8');
