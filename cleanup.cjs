const fs = require('fs');
const path = require('path');

const modalsPath = path.join(__dirname, 'src/components');
const files = fs.readdirSync(modalsPath).filter(f => f.endsWith('Modal.jsx'));

for (const file of files) {
  const filePath = path.join(modalsPath, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Clean up any double spaces, "sm: ", "flex flex", etc.
  content = content.replace(/className="([^"]+)"/g, (match, classes) => {
    let newClasses = classes
      .replace(/\bsm:\s/g, ' ')
      .replace(/\bflex flex\b/g, 'flex')
      .replace(/\bsm:max-h-\[92vh\]\b/g, '') // remove specific left-overs
      .replace(/\bsm:h-auto sm:h-auto\b/g, 'sm:h-auto')
      .replace(/\s+/g, ' ')
      .trim();
    return `className="${newClasses}"`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleaned', file);
}
