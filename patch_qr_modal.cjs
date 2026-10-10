const fs = require('fs');
let content = fs.readFileSync('src/components/WorkerProfileModal.jsx', 'utf8');

const qrModalJsx = `
      {/* QR Code Login Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">کد ورود اختصاصی پرسنل</h3>
              <button 
                onClick={() => setIsQRModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                این بارکد (یا لینک) را در اختیار <strong>{worker?.name}</strong> قرار دهید تا بتواند بدون نیاز به رمز عبور وارد پروفایل خود شود.
              </p>
              
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 inline-block">
                <QRCodeSVG value={qrUrl} size={180} level="H" includeMargin={false} />
              </div>

              <div className="mt-6 w-full space-y-2 text-start">
                <div className="text-xs text-slate-500">
                  <span>نام کاربری:</span> <strong className="text-slate-800 dark:text-slate-200 ml-1 select-all font-mono" dir="ltr">{generatedCreds?.username}</strong>
                </div>
                <div className="text-xs text-slate-500">
                  <span>رمز عبور:</span> <strong className="text-slate-800 dark:text-slate-200 ml-1 select-all font-mono" dir="ltr">{generatedCreds?.password}</strong>
                </div>
              </div>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText(qrUrl);
                  alert('لینک ورود کپی شد.');
                }}
                className="mt-6 w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-sm transition-colors"
              >
                کپی لینک ورود (Magic Link)
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(
  "    </div>\n  );\n\n  return typeof document",
  qrModalJsx + "\n    </div>\n  );\n\n  return typeof document"
);

fs.writeFileSync('src/components/WorkerProfileModal.jsx', content);
console.log('Patched modal successfully');
