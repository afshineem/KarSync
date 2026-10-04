import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { supabase } from '../services/realtimeSync';
import { Activity, Clock, Search, Filter, Eye, ChevronDown } from 'lucide-react';
import { usePermissions } from '../context/AuthContext';
import { logAuditAction } from '../services/auditLogger';

export default function AuditLogsTab({ workspaceId }) {
  const { currentUser } = usePermissions();
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('');

  const effectiveWorkspaceId = workspaceId || currentUser?.workspace_id;

  useEffect(() => {
    if (effectiveWorkspaceId) {
      loadLogs();
      const channel = supabase.channel('public:audit_logs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `workspace_id=eq.${effectiveWorkspaceId}` }, payload => {
          setLogs(prev => [payload.new, ...prev]);
          if (db.audit_logs) db.audit_logs.put(payload.new).catch(()=>{});
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [effectiveWorkspaceId]);

  const loadLogs = async () => {
    try {
      // 1. Try local first
      let localLogs = [];
      if (db.audit_logs) {
        localLogs = await db.audit_logs?.where('workspace_id').equals(effectiveWorkspaceId).toArray() || [];
        localLogs.sort((a,b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
        
        const orphanLogs = await db.audit_logs?.where('workspace_id').equals('local-offline-workspace').toArray() || [];
        if (orphanLogs.length > 0) {
           const updated = orphanLogs.map(l => ({...l, workspace_id: effectiveWorkspaceId}));
           await db.audit_logs.bulkPut(updated);
           if (navigator.onLine) supabase.from('audit_logs').upsert(updated).catch(()=>{});
           localLogs = [...updated, ...localLogs].sort((a,b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
        }
      }
      
      if (localLogs.length > 0) {
        setLogs(localLogs);
      }

      // 2. Sync from Supabase
      if (navigator.onLine) {
        const { data } = await supabase.from('audit_logs')
          .select('*')
          .eq('workspace_id', effectiveWorkspaceId)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (data && data.length > 0) {
          setLogs(data);
          if (db.audit_logs) await db.audit_logs.bulkPut(data).catch(()=>{});
        } else if (localLogs.length === 0) {
          // Auto-seed initial log if completely empty
          await logAuditAction({
            actionType: 'SYSTEM_INIT',
            entityType: 'WORKSPACE',
            entityId: effectiveWorkspaceId,
            details: { message: 'سیستم ممیزی کارگاه فعال شد' }
          });
          // Reload logs after 1 sec
          setTimeout(loadLogs, 1000);
        }
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const getTimeAgo = (dateString) => {
    const rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    const hours = Math.round(diff / (1000 * 60 * 60));
    const mins = Math.round(diff / (1000 * 60));

    if (days > 0) return rtf.format(-days, 'day');
    if (hours > 0) return rtf.format(-hours, 'hour');
    if (mins > 0) return rtf.format(-mins, 'minute');
    return 'لحظاتی پیش';
  };

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all') {
      const typeStr = (log.action_type || '').toUpperCase();
      if (filterType === 'USER' && !typeStr.includes('USER')) return false;
      if (filterType === 'ATTENDANCE' && !typeStr.includes('ATTENDANCE')) return false;
      if (filterType === 'FINANCIAL' && !typeStr.includes('EXPENSE') && !typeStr.includes('PAYMENT') && !typeStr.includes('SETTLEMENT')) return false;
      if (filterType === 'SYSTEM' && !typeStr.includes('SYSTEM')) return false;
    }
    if (filterUser && !log.user_name?.includes(filterUser)) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Filters */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="جستجو نام متصدی..." 
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-100 dark:bg-slate-900 border-transparent focus:border-blue-500 rounded-xl text-xs"
          />
        </div>
        <div className="relative flex-1 sm:max-w-[200px]">
          <Filter className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-100 dark:bg-slate-900 border-transparent focus:border-blue-500 rounded-xl text-xs appearance-none"
          >
            <option value="all">همه فعالیت‌ها</option>
            <option value="USER">فعالیت کاربران</option>
            <option value="ATTENDANCE">ورود و خروج / حضور</option>
            <option value="FINANCIAL">مالی و هزینه‌ها</option>
            <option value="SYSTEM">سیستم</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <Activity className="w-12 h-12 mb-3 opacity-20 text-blue-500" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">هنوز فعالیتی ثبت نشده است</h3>
            <p className="text-xs">پس از انجام عملیات، تاریخچه در اینجا نمایش داده می‌شود.</p>
          </div>
        ) : (
          <div className="relative border-r-2 border-blue-100 dark:border-blue-900/30 pr-4 mr-2 space-y-6">
            {filteredLogs.map(log => (
              <div key={log.id} className="relative">
                <div className="absolute -right-[23px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-50 dark:ring-slate-900"></div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      {log.user_name}
                    </span>
                    <div className="flex items-center gap-3">
                      {(log.action_type === 'CREATE_ATTENDANCE' || log.action_type === 'EDIT_ATTENDANCE' || log.action_type === 'CREATE_EXPENSE' || log.action_type === 'EDIT_EXPENSE') && log.details?.date && (
                        <button 
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('navigateApp', { detail: { tab: 'calendar' } }));
                            window.dispatchEvent(new CustomEvent('inspectDate', { detail: { date: log.details.date } }));
                            const closeBtn = document.querySelector('[data-close-global-settings]');
                            if(closeBtn) closeBtn.click();
                          }}
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors"
                          title="مشاهده در تقویم"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1" dir="ltr">
                        {getTimeAgo(log.created_at)} <Clock className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                  <details className="group cursor-pointer">
                    <summary className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium list-none flex items-center gap-2">
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform group-open:-rotate-180" />
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        [{log.action_type}]
                      </span>
                      {log.details?.description || log.details?.message || 'عملیات سیستمی انجام شد'}
                    </summary>
                    <div className="mt-2 pl-5 text-[10px] text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      {Object.entries(log.details || {}).map(([key, value]) => {
                         if (key === 'description' || key === 'message') return null;
                         return (
                           <div key={key} className="flex gap-2">
                             <span className="font-semibold">{key}:</span>
                             <span>{String(value)}</span>
                           </div>
                         );
                      })}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
