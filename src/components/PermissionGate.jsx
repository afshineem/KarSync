import React from 'react';
import { usePermissions } from '../context/AuthContext';

export default function PermissionGate({ permission, fallback = null, children }) {
  const { hasPermission, isRBACLoading } = usePermissions();

  if (isRBACLoading) {
    return null; // Or a loading spinner
  }

  if (!hasPermission(permission)) {
    if (fallback !== null) {
      return fallback;
    }
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">دسترسی غیرمجاز</h3>
        <p className="text-xs">شما مجوز لازم برای مشاهده این بخش را ندارید.</p>
      </div>
    );
  }

  return <>{children}</>;
}
