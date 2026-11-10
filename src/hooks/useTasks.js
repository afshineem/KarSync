import { useState, useCallback, useEffect } from 'react';
import { supabase, getScopedTaskProjectId, unscopeTaskProjectId } from '../services/realtimeSync';

export const useTasks = (projectId = null) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Read: دریافت لیست تسک‌ها با ایزولاسیون کامل فضای کاری و چندمستأجری
  const fetchTasks = useCallback(async (pId = projectId) => {
    setIsLoading(true);
    setError(null);
    try {
      const scopedPid = getScopedTaskProjectId(pId);
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      // فیلتر بر اساس شناسه‌ی پروژه ایزوله‌شده به کارگاه
      if (scopedPid) {
        query = query.eq('project_id', scopedPid);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      const cleaned = (data || []).map((t) => ({
        ...t,
        project_id: unscopeTaskProjectId(t.project_id)
      }));
      setTasks(cleaned);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Realtime Subscription: گوش دادن زنده به تغییرات جدول tasks صرفاً برای پروژه و کارگاه جاری
  useEffect(() => {
    const scopedTargetPid = getScopedTaskProjectId(projectId);
    const channelName = `realtime-tasks-${scopedTargetPid}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('⚡ Realtime Task Change received:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new;
            if (newTask.project_id === scopedTargetPid) {
              const normalized = {
                ...newTask,
                project_id: unscopeTaskProjectId(newTask.project_id)
              };
              setTasks((prev) => {
                if (prev.some((t) => t.id === normalized.id)) return prev;
                return [normalized, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            if (updated.project_id === scopedTargetPid) {
              const normalized = {
                ...updated,
                project_id: unscopeTaskProjectId(updated.project_id)
              };
              setTasks((prev) =>
                prev.map((t) => (t.id === normalized.id ? { ...t, ...normalized } : t))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setTasks((prev) =>
                prev.filter((t) => t.id !== deletedId && t.parent_id !== deletedId)
              );
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Realtime channel status error for tasks');
        } else {
          console.log('📡 Realtime tasks channel status:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Create: ساخت تسک یا سابتسک جدید به صورت ایزوله‌شده
  const addTask = async (taskData) => {
    try {
      const rawPid = taskData.project_id || projectId;
      const scopedPid = getScopedTaskProjectId(rawPid);

      const cleanData = {
        ...taskData,
        project_id: scopedPid,
        status: taskData.status || 'not_started',
        priority: taskData.priority || 'medium'
      };

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert([cleanData])
        .select()
        .single();

      if (insertError) throw insertError;
      
      const normalized = {
        ...data,
        project_id: unscopeTaskProjectId(data.project_id)
      };

      // آپدیت کردن استیت لوکال برای رندر فوری
      setTasks((prevTasks) => {
        if (prevTasks.some((t) => t.id === normalized.id)) return prevTasks;
        return [normalized, ...prevTasks];
      });
      return { success: true, data: normalized };
    } catch (err) {
      console.error('Error adding task:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update: ویرایش تسک (تغییر فیلدها، اولویت یا وضعیت)
  const updateTask = async (taskId, updates) => {
    try {
      const payload = { ...updates };
      if (payload.project_id) {
        payload.project_id = getScopedTaskProjectId(payload.project_id);
      }

      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      const normalized = {
        ...data,
        project_id: unscopeTaskProjectId(data.project_id)
      };

      // آپدیت کردن استیت لوکال بلافاصله پس از موفقیت درخواست
      setTasks((prevTasks) => 
        prevTasks.map((t) => (t.id === taskId ? { ...t, ...normalized } : t))
      );
      return { success: true, data: normalized };
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Delete: حذف تسک و حذف سابتسک‌های تابعه از استیت محلی
  const deleteTask = async (taskId) => {
    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (deleteError) throw deleteError;

      // حذف تسک و زیرتسک‌های وابسته از استیت لوکال برای تغییر آنی در UI
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId && t.parent_id !== taskId));
      return { success: true };
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  return {
    tasks,
    setTasks,
    isLoading,
    error,
    fetchTasks,
    addTask,
    updateTask,
    deleteTask
  };
};
