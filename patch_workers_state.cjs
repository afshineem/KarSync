const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Initial State
content = content.replace(
  /teamRole: 'Worker',\n\s*dailyRate: '35000',/g,
  `teamRole: 'Worker',\n    wageType: 'standard',\n    dailyRate: '35000',`
);

// 2. handleOpenAddModal
content = content.replace(
  /teamRole: 'Worker',\n\s*dailyRate: '35000',/g,
  `teamRole: 'Worker',\n      wageType: 'standard',\n      dailyRate: '35000',`
);

// 3. handleOpenEditModal
content = content.replace(
  /teamRole: worker\.teamRole \|\| 'Worker',\n\s*dailyRate: String\(worker\.dailyRate\),/g,
  `teamRole: worker.teamRole || 'Worker',\n      wageType: worker.wageType || 'standard',\n      dailyRate: String(worker.dailyRate),`
);

fs.writeFileSync(file, content, 'utf8');
