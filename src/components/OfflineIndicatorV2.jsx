import React, { useState } from 'react';
import { useOnlineStatus } from '@/components/hooks/useOnlineStatus';
import { WifiOff, Wifi, AlertCircle } from 'lucide-react';

export default function OfflineIndicatorV2() {
  const { isOnline } = useOnlineStatus();
  const [syncError, setSyncError] = useState(false);

  // Listener para erros de sincronização
  React.useEffect(() => {
    const handleSyncError = () => setSyncError(true);
    const handleSyncSuccess = () => setSyncError(false);

    window.addEventListener('sync-error', handleSyncError);
    window.addEventListener('sync-success', handleSyncSuccess);

    return () => {
      window.removeEventListener('sync-error', handleSyncError);
      window.removeEventListener('sync-success', handleSyncSuccess);
    };
  }, []);

  if (isOnline && !syncError) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-300 px-4 py-2 z-50 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-800 font-medium">
          Modo Offline - Dados salvos localmente
        </span>
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-50 border-b border-red-300 px-4 py-2 z-50 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm text-red-800 font-medium">
          Erro na sincronização - Toque para tentar novamente
        </span>
      </div>
    );
  }

  return null;
}