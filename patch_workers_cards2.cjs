const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetOvertimeCard = `<span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr
                    </span>`;
const replacementOvertimeCard = `<span className="font-bold text-slate-800 dark:text-slate-200">
                      {worker.wageType === 'contract' ? (
                        <span className="text-slate-400 text-xs">-</span>
                      ) : (
                        <span className="font-mono">{formatCurrency(worker.overtimeHourlyRate, currency, language)} / hr</span>
                      )}
                    </span>`;

content = content.replace(targetOvertimeCard, replacementOvertimeCard);

fs.writeFileSync(file, content, 'utf8');
