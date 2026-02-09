import { useEffect, useState } from 'react';
import { NotificationService } from './NotificationService';
import { SyncService } from './SyncService';

/**
 * Hook para gerenciar background sync automático
 * Sincroniza dados periodicamente quando online
 */
export function useBackgroundSync(enabled = true) {
    const [pendingTags, setPendingTags] = useState([]);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        const checkPendingSync = async () => {
            const tags = await NotificationService.getBackgroundSyncTags();
            setPendingTags(tags);
        };

        // Verificar tags pendentes
        checkPendingSync();

        // Registrar para online event
        const handleOnline = async () => {
            console.log('Online detectado - tentando sincronizar');
            setIsRegistering(true);
            
            try {
                // Registrar background sync
                await NotificationService.registerBackgroundSync('sync-fiscalizacao-data');
                
                // Sincronizar imediatamente
                await SyncService.sync();
                
                NotificationService.showSyncNotification('success');
            } catch (error) {
                console.error('Erro ao sincronizar:', error);
                NotificationService.showSyncNotification('error', { 
                    message: error.message 
                });
            } finally {
                setIsRegistering(false);
            }
        };

        // Registrar para offline event
        const handleOffline = () => {
            console.log('Offline detectado');
            NotificationService.showSyncNotification('offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Verificar tags a cada 30 segundos
        const interval = setInterval(checkPendingSync, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [enabled]);

    const registerSync = async (tag = 'sync-fiscalizacao-data') => {
        setIsRegistering(true);
        try {
            await NotificationService.registerBackgroundSync(tag);
            const tags = await NotificationService.getBackgroundSyncTags();
            setPendingTags(tags);
            return true;
        } catch (error) {
            console.error('Erro ao registrar sync:', error);
            return false;
        } finally {
            setIsRegistering(false);
        }
    };

    const clearSync = async (tag = 'sync-fiscalizacao-data') => {
        setIsRegistering(true);
        try {
            // Simular remover tag (não há API nativa)
            const tags = await NotificationService.getBackgroundSyncTags();
            setPendingTags(tags.filter(t => t !== tag));
            return true;
        } finally {
            setIsRegistering(false);
        }
    };

    return {
        pendingTags,
        isRegistering,
        registerSync,
        clearSync
    };
}