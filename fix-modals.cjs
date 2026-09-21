const fs = require('fs');
const path = require('path');

const modalsPath = path.join(__dirname, 'src/components');
const files = fs.readdirSync(modalsPath).filter(f => f.endsWith('Modal.jsx'));

for (const file of files) {
  const filePath = path.join(modalsPath, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Fix the backdrop:
  // Find the div that has `fixed inset-0`
  content = content.replace(/className="(fixed inset-0[^"]+)"/g, (match, classes) => {
    // Remove problem classes
    let newClasses = classes
      .replace(/\boverflow-y-auto\b/g, '')
      .replace(/\bitems-start\b/g, '')
      .replace(/\bsm:items-center\b/g, '')
      .replace(/\bitems-center\b/g, '')
      .replace(/\bjustify-center\b/g, '')
      .replace(/\bp-0\b/g, '')
      .replace(/\bsm:p-4\b/g, '')
      .replace(/\bprint:p-0\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Add back the standard correct classes
    newClasses += ' flex items-center justify-center p-0 sm:p-4 print:p-0';
    return `className="${newClasses}"`;
  });

  // 2. Fix the inner container:
  // Find the div that has `bg-white dark:bg-slate-900` or similar container structure right after backdrop
  content = content.replace(/className="(bg-white dark:bg-slate-900[^"]+)"/g, (match, classes) => {
    let newClasses = classes
      .replace(/\bh-full\b/g, '')
      .replace(/\bsm:h-auto\b/g, '')
      .replace(/\bmy-auto\b/g, '')
      .replace(/\bsm:my-auto\b/g, '')
      .replace(/\bmax-h-\[[^\]]+\]\b/g, '')
      .replace(/\bsm:max-h-\[[^\]]+\]\b/g, '')
      .replace(/\boverflow-y-auto\b/g, '')
      .replace(/\bflex flex-col\b/g, '')
      .replace(/\bh-\[100dvh\]\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Add back the standard correct classes
    newClasses += ' h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-y-auto';
    return `className="${newClasses}"`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', file);
}
