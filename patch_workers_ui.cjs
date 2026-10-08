const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

const newFormUI = `                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>{language === 'fa' ? 'نوع دستمزد' : 'جۆری کرێ'}</span>
                  </label>
                  <select
                    value={formData.wageType || 'standard'}
                    onChange={(e) => setFormData({ ...formData, wageType: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="standard">{language === 'fa' ? 'عادی (مزد روزانه)' : 'ستاندارد (کرێی ڕۆژانە)'}</option>
                    <option value="contract">{language === 'fa' ? 'کنتراکت (توافقی / مقاطعه)' : 'گرێبەست (بڕاوە)'}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3" style={{ opacity: formData.wageType === 'contract' ? 0.5 : 1, pointerEvents: formData.wageType === 'contract' ? 'none' : 'auto' }}>`;

content = content.replace(/<div className="grid grid-cols-2 gap-3">/g, (match, offset) => {
  if (offset > 160000) {
    // skip very early ones, wait length is probably ~70-80k chars
    return match;
  }
  return match;
});

// Actually, let's just target the specific one after the default section hint.
const marker = `{t('defaultSectionHint') || 'این بخش در ثبت روزانه به صورت خودکار برای پرسنل لود می‌شود اما برای هر روز قابل تغییر است.'}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">`;

const replacement = `{t('defaultSectionHint') || 'این بخش در ثبت روزانه به صورت خودکار برای پرسنل لود می‌شود اما برای هر روز قابل تغییر است.'}
                    </p>
                  </div>
                )}

` + newFormUI;

content = content.replace(marker, replacement);

fs.writeFileSync(file, content, 'utf8');
