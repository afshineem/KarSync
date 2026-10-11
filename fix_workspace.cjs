const fs = require('fs');
let content = fs.readFileSync('src/components/WorkerProfileModal.jsx', 'utf8');

const oldLogic = `      let workspaceCode = '';
      if (user?.workspace_id) {
        const ws = await db.workspaces.get(user.workspace_id);
        if (ws && ws.workspace_code) workspaceCode = ws.workspace_code;
      }`;

const newLogic = `      let workspaceCode = '';
      if (user?.workspace_id) {
        const ws = await db.workspaces.get(user.workspace_id);
        if (ws && ws.workspace_code) workspaceCode = ws.workspace_code;
      }
      if (!workspaceCode) {
        const allWs = await db.workspaces.toArray();
        if (allWs.length > 0 && allWs[0].workspace_code) {
          workspaceCode = allWs[0].workspace_code;
        }
      }
      if (!workspaceCode) {
         alert('کد کارگاه در حافظه یافت نشد! لطفاً یک بار از حساب کاربری خارج شده و مجدداً وارد شوید.');
         return;
      }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/WorkerProfileModal.jsx', content);
console.log('Fixed workspaceCode generation');
