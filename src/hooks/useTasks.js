import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/realtimeSync';

export const useTasks = (projectId = null) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Read: دریافت لیست تسک‌ها
  const fetchTasks = useCallback(async (pId = projectId) => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      // در صورت وجود پروژه خاص، تسک‌های همان پروژه را فیلتر می‌کنیم
      if (pId) {
        query = query.eq('project_id', pId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Realtime Subscription: گوش دادن زنده به تغییرات جدول tasks
  useEffect(() => {
    const channelName = `realtime-tasks-${projectId || 'all'}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('⚡ Realtime Task Change received:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new;
            if (!projectId || newTask.project_id === projectId) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === newTask.id)) return prev;
                return [newTask, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
            );
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

  // Create: ساخت تسک یا سابتسک جدید
  const addTask = async (taskData) => {
    try {
      const cleanData = {
        ...taskData,
        status: taskData.status || 'not_started',
        priority: taskData.priority || 'medium'
      };

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert([cleanData])
        .select()
        .single();

      if (insertError) throw insertError;
      
      // آپدیت کردن استیت لوکال برای رندر فوری
      setTasks(prevTasks => {
        if (prevTasks.some(t => t.id === data.id)) return prevTasks;
        return [data, ...prevTasks];
      });
      return { success: true, data };
    } catch (err) {
      console.error('Error adding task:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update: ویرایش تسک (تغییر فیلدها، اولویت یا وضعیت)
  const updateTask = async (taskId, updates) => {
    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      // آپدیت کردن استیت لوکال بلافاصله پس از موفقیت درخواست
      setTasks(prevTasks => 
        prevTasks.map(t => (t.id === taskId ? { ...t, ...data } : t))
      );
      return { success: true, data };
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
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId && t.parent_id !== taskId));
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
