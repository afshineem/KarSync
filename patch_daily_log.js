const fs = require('fs');
const file = 'src/components/DailyLoggingModal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const safeAuth = await getSafeAuthContext\(\);\s*await logAuditAction\(\{[\s\S]*?\}\);\s*\}/g,
  `} // End loop here? Wait, let's just do a regex replace more precisely`
);

fs.writeFileSync(file, content, 'utf8');
