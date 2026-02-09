import { useEffect } from 'react';
import { usePushNotifications } from '@/components/hooks/usePushNotifications.js';
import { useBackgroundSync } from '@/components/offline/useBackgroundSync.js';
import { SyncService } from '@/components/offline/SyncService';
import { NotificationService } from '@/components/offline/NotificationService.js';

/**
 * Componente que inicializa notificações push e background sync
 * Deve ser adicionado no layout principal
 */
export default function PushNotificationInitializer() {
    const { requestPermission } = usePushNotifications();
    const { registerSync } = useBackgroundSync(true);

    useEffect(() => {
        // Inicializar notificações
        requestPermission();

        // Listener para eventos de sincronização
        const handleSyncStarted = () => {
            NotificationService.showSyncNotification('started');
        };

        const handleSyncSuccess = (event) => {
            const { successCount } = event.detail;
            NotificationService.showSyncNotification('success', { count: successCount });
        };

        const handleSyncError = (event) => {
            const { message } = event.detail;
            NotificationService.showSyncNotification('error', { message });
        };

        const handlePendingItems = async () => {
            const status = await SyncService.getSyncStatus();
            if (status.pendingCount > 0) {
                NotificationService.showPendingDataNotification(status.pendingCount);
            }
        };

        // Registrar listeners
        window.addEventListener('sync-started', handleSyncStarted);
        window.addEventListener('sync-success', handleSyncSuccess);
        window.addEventListener('sync-error', handleSyncError);
        window.addEventListener('app-online', handlePendingItems);

        // Iniciar auto-sync
        SyncService.startAutoSync(300000); // 5 minutos

        return () => {
            window.removeEventListener('sync-started', handleSyncStarted);
            window.removeEventListener('sync-success', handleSyncSuccess);
            window.removeEventListener('sync-error', handleSyncError);
            window.removeEventListener('app-online', handlePendingItems);
        };
    }, [requestPermission]);

    return null; // Componente invisível
}