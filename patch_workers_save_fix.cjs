const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /wageType: formData\.wageType \|\| 'standard',\n\s*wageType: formData\.wageType \|\| 'standard',/g,
  `wageType: formData.wageType || 'standard',`
);

// For create
content = content.replace(
  /teamRole: formData\.teamRole \|\| 'Worker',(?!\n\s*wageType)/g,
  `teamRole: formData.teamRole || 'Worker',\n          wageType: formData.wageType || 'standard',`
);

fs.writeFileSync(file, content, 'utf8');
