const fs = require('fs');
const file = 'src/components/DailyLoggingModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the block inside the loop
const newBlock = `
          await db.attendanceLogs.put(newRecord);
          savedLogs.push({ newRecord, existingLog, workerName: worker.name, type: cfg.type });
        }
      });

      // Execute Audit logs outside Dexie transaction to prevent "Transaction committed too early"
      const safeAuth = await getSafeAuthContext();
      for (const logInfo of savedLogs) {
        const { newRecord, existingLog, workerName, type } = logInfo;
        await logAuditAction({
          workspaceId: safeAuth.workspaceId,
          userId: safeAuth.userId,
          userName: safeAuth.userName,
          actionType: existingLog ? 'EDIT_ATTENDANCE' : 'CREATE_ATTENDANCE',
          entityType: 'attendanceLogs',
          entityId: newRecord.id,
          projectId: newRecord.projectId,
          details: {
            description: existingLog 
              ? \`ویرایش کارکرد \${workerName} در تاریخ \${selectedDate}\` 
              : \`ثبت کارکرد \${workerName} در تاریخ \${selectedDate}\`,
            worker_name: workerName,
            date: selectedDate,
            type: type
          }
        }).catch(err => console.warn('Audit error:', err));
      }

      const logsToPush = savedLogs.map(info => info.newRecord);
      
      // Realtime push to Supabase
      if (logsToPush.length > 0) {
        pushLogsLive(logsToPush).catch((err) => console.warn('Supabase live push warning:', err));
      }
`;

// we need to slice it precisely
const startMarker = "          await db.attendanceLogs.put(newRecord);";
const endMarker = "pushLogsLive(savedLogs).catch((err) => console.warn('Supabase live push warning:', err));\n      }";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker) + endMarker.length;

if (startIndex > -1 && endIndex > -1) {
  content = content.slice(0, startIndex) + newBlock.trim() + content.slice(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched successfully");
} else {
  console.log("Markers not found");
}
