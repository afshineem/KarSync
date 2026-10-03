-- Delete all app_users except admin and owner
DELETE FROM public.app_users WHERE role NOT IN ('admin', 'owner');
