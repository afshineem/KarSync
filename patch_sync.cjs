const fs = require('fs');
const file = 'src/services/realtimeSync.js';
let content = fs.readFileSync(file, 'utf8');

// In pushWorkerLive
content = content.replace(
  /groupId: w\.groupId \|\| null,\n\s*teamRole: w\.teamRole \|\| 'Worker',/g,
  `groupId: w.groupId || null,\n    teamRole: w.teamRole || 'Worker',\n    wageType: w.wageType || 'standard',`
);

// In syncWorkerMetadata (pullWorkerMetadata) - wait, pullWorkerMetadataLive?
