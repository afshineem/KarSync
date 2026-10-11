const fs = require('fs');
let content = fs.readFileSync('src/components/WorkerProfileModal.jsx', 'utf8');

const targetUI = `<div className="mt-6 w-full space-y-2 text-start">`;
const newUI = `<div className="mt-6 w-full space-y-2 text-start">
                <div className="text-xs text-slate-500">
                  <span>کد کارگاه:</span> <strong className="text-slate-800 dark:text-slate-200 ml-1 select-all font-mono" dir="ltr">{new URLSearchParams(qrUrl.split('?')[1]).get('w')}</strong>
                </div>`;

content = content.replace(targetUI, newUI);
fs.writeFileSync('src/components/WorkerProfileModal.jsx', content);
console.log('Fixed modal UI');
