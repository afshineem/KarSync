const fs = require('fs');
const file = 'src/components/WorkersView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update initial formData in handleOpenAddModal and state
content = content.replace(
  /teamRole: 'Worker',[\s]*dailyRate: '35000',/g,
  `teamRole: 'Worker',\n      wageType: 'standard',\n      dailyRate: '35000',`
);

// 2. Update handleOpenEditModal
content = content.replace(
  /teamRole: worker\.teamRole \|\| 'Worker',[\s]*dailyRate: worker\.dailyRate \|\| '0',/g,
  `teamRole: worker.teamRole || 'Worker',\n      wageType: worker.wageType || 'standard',\n      dailyRate: worker.dailyRate || '0',`
);

// 3. Update the form UI to add wageType dropdown before dailyRate
const formUIReplacement = `                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('dailyRateLabel')} *
                    </label>`;

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

                <div className="grid grid-cols-2 gap-3" style={{ opacity: formData.wageType === 'contract' ? 0.5 : 1, pointerEvents: formData.wageType === 'contract' ? 'none' : 'auto' }}>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('dailyRateLabel')} *
                    </label>`;

content = content.replace(formUIReplacement, newFormUI);

// 4. Update handleSaveWorker
// we need to make sure wageType is passed correctly. 
// Let's find handleSaveWorker in WorkersView.jsx
