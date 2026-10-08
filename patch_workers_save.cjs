const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const dailyRate = Number\(formData\.dailyRate\);\n\s*const overtimeRate = Number\(formData\.overtimeHourlyRate\);/g,
  `const isContract = formData.wageType === 'contract';\n    const dailyRate = isContract ? 0 : Number(formData.dailyRate);\n    const overtimeRate = isContract ? 0 : Number(formData.overtimeHourlyRate);`
);

content = content.replace(
  /teamRole: formData\.teamRole \|\| 'Worker',/g,
  `teamRole: formData.teamRole || 'Worker',\n          wageType: formData.wageType || 'standard',`
);

content = content.replace(
  /teamRole: formData\.teamRole \|\| 'Worker',/g, // This might hit twice, let's just do it cleanly in JS
  `teamRole: formData.teamRole || 'Worker',\n          wageType: formData.wageType || 'standard',`
);

fs.writeFileSync(file, content, 'utf8');
