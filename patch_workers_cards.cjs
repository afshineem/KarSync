const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetDailyCard = `<span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formatCurrency(worker.dailyRate, currency, language)}
                    </span>`;
const replacementDailyCard = `<span className="font-bold text-slate-800 dark:text-slate-200">
                      {worker.wageType === 'contract' ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300 font-normal">توافقی (کنتراکت)</span>
                      ) : (
                        <span className="font-mono">{formatCurrency(worker.dailyRate, currency, language)}</span>
                      )}
                    </span>`;

const targetOvertimeCard = `<span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                      {formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr
                    </span>`;
const replacementOvertimeCard = `<span className="font-medium text-slate-700 dark:text-slate-300">
                      {worker.wageType === 'contract' ? (
                        <span className="text-slate-400 text-xs">-</span>
                      ) : (
                        <span className="font-mono">{formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr</span>
                      )}
                    </span>`;

content = content.replace(targetDailyCard, replacementDailyCard);
content = content.replace(targetOvertimeCard, replacementOvertimeCard);

fs.writeFileSync(file, content, 'utf8');
