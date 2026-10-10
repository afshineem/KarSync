const fs = require('fs');
let content = fs.readFileSync('src/components/WorkerProfileModal.jsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { useProject } from '../context/ProjectContext';",
  "import { useProject } from '../context/ProjectContext';\nimport { useAuth } from '../context/AuthContext';\nimport { QRCodeSVG } from 'qrcode.react';"
);

// 2. Add useAuth destructuring
content = content.replace(
  "const { currentProject, currency = 'IQD' } = useProject();",
  "const { currentProject, currency = 'IQD' } = useProject();\n  const { user, setWorkerCredentials, getWorkerCredentialsMap } = useAuth();"
);

// 3. Add QR Modal States
content = content.replace(
  "const [isEditWorkerModalOpen, setIsEditWorkerModalOpen] = useState(false);",
  "const [isEditWorkerModalOpen, setIsEditWorkerModalOpen] = useState(false);\n  const [isQRModalOpen, setIsQRModalOpen] = useState(false);\n  const [qrUrl, setQrUrl] = useState('');\n  const [generatedCreds, setGeneratedCreds] = useState(null);"
);

// 4. Add handleOpenQRModal
const qrFunction = `
  const handleOpenQRModal = async () => {
    try {
      let creds = getWorkerCredentialsMap()[workerId];
      
      if (!creds || !creds.username || !creds.password) {
         const newUsername = 'w_' + workerId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) + Math.floor(100 + Math.random() * 900);
         const newPassword = Math.random().toString(36).slice(-8);
         await setWorkerCredentials(workerId, newUsername, newPassword);
         creds = { username: newUsername, password: newPassword };
      }
      
      let workspaceCode = '';
      if (user?.workspace_id) {
        const ws = await db.workspaces.get(user.workspace_id);
        if (ws && ws.workspace_code) workspaceCode = ws.workspace_code;
      }
      
      const loginUrl = \`\${window.location.origin}/?w=\${encodeURIComponent(workspaceCode)}&u=\${encodeURIComponent(creds.username)}&p=\${encodeURIComponent(creds.password)}\`;
      
      setQrUrl(loginUrl);
      setGeneratedCreds(creds);
      setIsQRModalOpen(true);
    } catch (err) {
      console.error('Error generating QR', err);
    }
  };
`;
content = content.replace(
  "// Close on Escape key press",
  qrFunction + "\n  // Close on Escape key press"
);

// 5. Add button in Quick Action Pill Bar
const btnCode = `
            <button
              type="button"
              onClick={handleOpenQRModal}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-200 hover:text-white border border-indigo-500/30 font-bold flex items-center gap-1.5 transition-all shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>لینک / بارکد ورود</span>
            </button>
`;
content = content.replace(
  "<span>ثبت سریع ماهانه</span>\n            </button>",
  "<span>ثبت سریع ماهانه</span>\n            </button>\n" + btnCode
);

// 6. Add the QR Code Modal JSX at the end before final </div> of modalContent
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
                  <span>نام کاربری:</span> <strong className="text-slate-800 dark:text-slate-200 ml-1 select-all font-mono">{generatedCreds?.username}</strong>
                </div>
                <div className="text-xs text-slate-500">
                  <span>رمز عبور:</span> <strong className="text-slate-800 dark:text-slate-200 ml-1 select-all font-mono">{generatedCreds?.password}</strong>
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
  "    </div>\n  );\n\n  return createPortal(",
  qrModalJsx + "\n    </div>\n  );\n\n  return createPortal("
);

fs.writeFileSync('src/components/WorkerProfileModal.jsx', content);
console.log('Patched successfully');
