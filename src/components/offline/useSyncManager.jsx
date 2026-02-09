import { useState, useEffect } from 'react';
import { SyncService } from './SyncService';

/**
 * Hook para gerenciar sincronização na UI
 */
export function useSyncManager() {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    hasErrors: false
  });

  useEffect(() => {
    // Atualiza status inicial
    SyncService.getSyncStatus().then(setStatus);

    // Listeners para eventos de sync
    const handleSyncStarted = () => {
      setStatus(prev => ({ ...prev, isSyncing: true }));
    };

    const handleSyncSuccess = (event) => {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingCount: 0,
        failedCount: 0,
        hasErrors: false
      }));
    };

    const handleSyncError = (event) => {
      SyncService.getSyncStatus().then(newStatus => {
        setStatus(prev => ({
          ...prev,
          isSyncing: false,
          hasErrors: true,
          ...newStatus
        }));
      });
    };

    window.addEventListener('sync-started', handleSyncStarted);
    window.addEventListener('sync-success', handleSyncSuccess);
    window.addEventListener('sync-error', handleSyncError);

    // Polling para atualizar contadores
    const pollInterval = setInterval(() => {
      if (!status.isSyncing) {
        SyncService.getSyncStatus().then(newStatus => {
          setStatus(prev => {
            if (prev.pendingCount !== newStatus.pendingCount ||
                prev.failedCount !== newStatus.failedCount) {
              return newStatus;
            }
            return prev;
          });
        });
      }
    }, 5000);

    return () => {
      window.removeEventListener('sync-started', handleSyncStarted);
      window.removeEventListener('sync-success', handleSyncSuccess);
      window.removeEventListener('sync-error', handleSyncError);
      clearInterval(pollInterval);
    };
  }, []);

  const manualSync = async () => {
    return SyncService.forceSync();
  };

  const retryFailed = async () => {
    return SyncService.retryFailed();
  };

  return {
    ...status,
    manualSync,
    retryFailed,
    isConnected: navigator.onLine
  };
}