import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { supabase } from '../services/realtimeSync';
import { Activity, Clock, Search, Filter } from 'lucide-react';
import { usePermissions } from '../context/AuthContext';

export default function AuditLogsTab() {
  const { currentUser } = usePermissions();
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    if (currentUser?.workspace_id) {
      loadLogs();
      const channel = supabase.channel('public:audit_logs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `workspace_id=eq.${currentUser.workspace_id}` }, payload => {
          setLogs(prev => [payload.new, ...prev]);
          if (db.audit_logs) db.audit_logs.put(payload.new).catch(()=>{});
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  const loadLogs = async () => {
    try {
      // 1. Try local first
      let localLogs = [];
      if (db.audit_logs) {
        localLogs = await db.audit_logs.where('workspace_id').equals(currentUser.workspace_id).reverse().sortBy('created_at');
        setLogs(localLogs);
      }
      
      // 2. Fetch from remote
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('workspace_id', currentUser.workspace_id)
          .order('created_at', { ascending: false })
          .limit(100);
          
        if (data && !error) {
          setLogs(data);
          if (db.audit_logs) await db.audit_logs.bulkPut(data).catch(()=>{});
        }
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
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
    if (filterType !== 'all' && !log.action_type?.startsWith(filterType)) return false;
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
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select 
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">همه رویدادها</option>
          <option value="ATTENDANCE">حضور و غیاب</option>
          <option value="SETTLEMENT">تسویه و پرداخت</option>
          <option value="EXPENSE">هزینه‌ها</option>
          <option value="USER">مدیریت کاربران</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 py-10 text-xs">
            هیچ لاگ یا فعالیتی یافت نشد.
          </div>
        ) : (
          <div className="relative border-r-2 border-indigo-100 dark:border-indigo-900/30 pr-4 mr-2 space-y-6">
            {filteredLogs.map(log => (
              <div key={log.id} className="relative">
                <div className="absolute -right-[23px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-50 dark:ring-slate-900"></div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-500" />
                      {log.user_name}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1" dir="ltr">
                      {getTimeAgo(log.created_at)} <Clock className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {log.details?.description || `${log.action_type} روی موجودیت ${log.entity_type}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
