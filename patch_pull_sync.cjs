const fs = require('fs');
const file = 'src/services/realtimeSync.js';
let content = fs.readFileSync(file, 'utf8');

// In pullWorkerMetadataLive check local -> cloud
content = content.replace(
  /groupId: w\.groupId \|\| null,\n\s*teamRole: w\.teamRole \|\| 'Worker',/g,
  `groupId: w.groupId || null,\n            teamRole: w.teamRole || 'Worker',\n            wageType: w.wageType || 'standard',`
);

// In pullWorkerMetadataLive check cloud -> local
const cloudToLocalMarker = `if (meta.teamRole && w.teamRole !== meta.teamRole) {
            updates.teamRole = meta.teamRole;
            needsUpdate = true;
          }`;
const cloudToLocalReplace = `if (meta.teamRole && w.teamRole !== meta.teamRole) {
            updates.teamRole = meta.teamRole;
            needsUpdate = true;
          }
          if (meta.wageType && w.wageType !== meta.wageType) {
            updates.wageType = meta.wageType;
            needsUpdate = true;
          }`;
content = content.replace(cloudToLocalMarker, cloudToLocalReplace);

fs.writeFileSync(file, content, 'utf8');
