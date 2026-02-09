import { useEffect, useRef } from 'react';
import { NotificationService } from '@/components/offline/NotificationService';
import { SyncService } from '@/components/offline/SyncService';

/**
 * Hook para gerenciar notificações push
 * Integra com background sync e notifica usuário de sincronizações
 */
export function usePushNotifications() {
    const notificationRef = useRef(false);

    useEffect(() => {
        // Solicitar permissão para notificações na primeira montagem
        if (!notificationRef.current) {
            NotificationService.requestPermission();
            notificationRef.current = true;
        }

        // Listener para mensagens do Service Worker
        const handleMessage = async (event) => {
            const { type, data } = event.data;

            if (type === 'sync-started') {
                NotificationService.showSyncNotification('started');
            } else if (type === 'sync-success') {
                NotificationService.showSyncNotification('success', { 
                    count: data?.itemCount || 1 
                });
            } else if (type === 'sync-error') {
                NotificationService.showSyncNotification('error', { 
                    message: data?.message 
                });
            } else if (type === 'offline-mode') {
                NotificationService.showSyncNotification('offline');
            } else if (type === 'pending-items') {
                NotificationService.showPendingDataNotification(data?.count || 0);
            }
        };

        // Registrar listener
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleMessage);
        }

        // Listener para notification click
        const handleNotificationClick = async (event) => {
            if (event.action === 'retry-sync') {
                await NotificationService.registerBackgroundSync();
                await SyncService.sync();
            } else if (event.action === 'sync-now') {
                await SyncService.sync();
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.onnotificationclick = handleNotificationClick;
            });
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            }
        };
    }, []);

    return {
        requestPermission: () => NotificationService.requestPermission(),
        showNotification: (status, data) => NotificationService.showSyncNotification(status, data),
        registerBackgroundSync: (tag) => NotificationService.registerBackgroundSync(tag)
    };
}