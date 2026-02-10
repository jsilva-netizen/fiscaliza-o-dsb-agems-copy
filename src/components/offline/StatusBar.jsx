import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import DataService from './dataService';
import SyncPanel from './SyncPanel';

export default function StatusBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updatePendingCount = async () => {
      try {
        if (DataService && typeof DataService.getSyncStatus === 'function') {
          const status = await DataService.getSyncStatus();
          setPendingCount(status.pendingCount);
        }
      } catch (error) {
        console.error('Erro ao contar pendentes:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    window.addEventListener('data-service:sync-complete', updatePendingCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('data-service:sync-complete', updatePendingCount);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className={`${isOnline ? 'bg-white border-b border-gray-200' : 'bg-red-50 border-b border-red-200'} px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`text-sm ${isOnline ? 'text-gray-600' : 'text-red-600'} font-medium`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs text-gray-500">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {(pendingCount > 0 || isOnline) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen(true)}
              className="h-6 px-3 text-xs hover:bg-gray-100"
            >
              Sincronizar
            </Button>
          )}
        </div>
      </div>

      <SyncPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}