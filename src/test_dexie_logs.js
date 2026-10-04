import { db } from './db/db.js';
db.audit_logs.toArray().then(logs => console.log('LOGS:', logs)).catch(e => console.error(e));
