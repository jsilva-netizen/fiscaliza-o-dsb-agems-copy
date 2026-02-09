// Serviço para gerenciar notificações push do navegador

export const NotificationService = {
    /**
     * Solicita permissão para notificações
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Browser não suporta notificações');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    },

    /**
     * Mostra notificação de sincronização
     */
    showSyncNotification(status = 'started', data = {}) {
        if (Notification.permission !== 'granted') return;

        const notificationData = {
            started: {
                title: 'Sincronizando dados...',
                options: {
                    body: 'Enviando alterações para o servidor',
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: 'sync-notification',
                    requireInteraction: false,
                }
            },
            success: {
                title: 'Sincronização concluída',
                options: {
                    body: `${data.count || 1} item${data.count !== 1 ? 'ns' : ''} sincronizado${data.count !== 1 ? 's' : ''}`,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: 'sync-notification',
                    requireInteraction: false,
                }
            },
            error: {
                title: 'Erro na sincronização',
                options: {
                    body: data.message || 'Tente novamente quando estiver online',
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: 'sync-notification',
                    requireInteraction: true,
                    actions: [
                        { action: 'retry-sync', title: 'Tentar Novamente' },
                        { action: 'dismiss', title: 'Descartar' }
                    ]
                }
            },
            offline: {
                title: 'Você está offline',
                options: {
                    body: 'Alterações serão sincronizadas quando estiver online',
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: 'offline-notification',
                    requireInteraction: false,
                }
            }
        };

        const notification = notificationData[status];
        if (!notification) return;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(notification.title, notification.options);
            });
        } else {
            new Notification(notification.title, notification.options);
        }
    },

    /**
     * Mostra notificação de dados pendentes
     */
    showPendingDataNotification(pendingCount) {
        if (Notification.permission !== 'granted') return;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('Dados pendentes', {
                    body: `Você tem ${pendingCount} item${pendingCount !== 1 ? 'ns' : ''} aguardando sincronização`,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: 'pending-notification',
                    requireInteraction: false,
                    actions: [
                        { action: 'sync-now', title: 'Sincronizar Agora' }
                    ]
                });
            });
        }
    },

    /**
     * Solicita background sync
     */
    async registerBackgroundSync(tag = 'sync-fiscalizacao-data') {
        if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
            console.warn('Background Sync não suportado');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register(tag);
            return true;
        } catch (error) {
            console.error('Erro ao registrar background sync:', error);
            return false;
        }
    },

    /**
     * Verifica se tem background sync pendente
     */
    async getBackgroundSyncTags() {
        if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
            return [];
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            return await registration.sync.getTags();
        } catch (error) {
            console.error('Erro ao obter background sync tags:', error);
            return [];
        }
    }
};