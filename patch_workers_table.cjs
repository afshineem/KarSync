const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetDailyRate = `<td className="py-2.5 px-3.5 font-bold font-mono text-slate-800 dark:text-slate-200">
                        {formatCurrency(worker.dailyRate, currency, language)}
                      </td>`;
const replacementDailyRate = `<td className="py-2.5 px-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {worker.wageType === 'contract' ? (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300 font-normal">توافقی (کنتراکت)</span>
                        ) : (
                          <span className="font-mono">{formatCurrency(worker.dailyRate, currency, language)}</span>
                        )}
                      </td>`;

const targetOvertimeRate = `<td className="py-2.5 px-3.5 font-medium font-mono text-slate-700 dark:text-slate-300">
                        {formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr
                      </td>`;
const replacementOvertimeRate = `<td className="py-2.5 px-3.5 font-medium text-slate-700 dark:text-slate-300">
                        {worker.wageType === 'contract' ? (
                          <span className="text-slate-400 text-xs">-</span>
                        ) : (
                          <span className="font-mono">{formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr</span>
                        )}
                      </td>`;

content = content.replace(targetDailyRate, replacementDailyRate);
content = content.replace(targetOvertimeRate, replacementOvertimeRate);

fs.writeFileSync(file, content, 'utf8');
