import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import DataService from './dataService';
import SyncPanel from './SyncPanel';

export default function StatusBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleSync = () => {
    setIsOpen(true);
    setIsSyncing(true);
  };

  return (
    <>
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-500">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-500">Offline</span>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={handleSync}
          className="h-10 px-4 text-sm gap-2 hover:bg-gray-100"
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
      </div>

      <SyncPanel 
        isOpen={isOpen} 
        onClose={() => {
          setIsOpen(false);
          setIsSyncing(false);
        }} 
      />
    </>
  );
}