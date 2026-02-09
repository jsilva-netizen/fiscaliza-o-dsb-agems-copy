export class NotificationService {
  static async requestPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      localStorage.setItem('notificationPermission', result);
      return result;
    }

    return Notification.permission;
  }

  static async showSyncNotification(type, data = {}) {
    if (Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;

      const options = {
        started: {
          title: 'Sincronização iniciada',
          body: 'Iniciando sincronização de dados...',
          tag: 'sync-notification',
          badge: '/icon-192.png'
        },
        success: {
          title: 'Sincronização concluída',
          body: 'Todos os dados foram sincronizados com sucesso.',
          tag: 'sync-notification',
          badge: '/icon-192.png'
        },
        error: {
          title: 'Erro na sincronização',
          body: data.message || 'Houve um erro ao sincronizar os dados.',
          tag: 'sync-notification',
          badge: '/icon-192.png'
        },
        offline: {
          title: 'Modo offline',
          body: 'Você está offline. Os dados serão sincronizados quando conectado.',
          tag: 'offline-notification',
          badge: '/icon-192.png'
        },
        pending: {
          title: `${data.count} itens pendentes`,
          body: 'Esses itens serão sincronizados quando conectado.',
          tag: 'pending-notification',
          badge: '/icon-192.png'
        }
      };

      const notificationOptions = options[type] || options.started;
      registration.showNotification(notificationOptions.title, notificationOptions);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  static setupMessageListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
          const { type, message } = event.data;
          // Handle various message types from service worker
          console.log('Message from SW:', type, message);
        }
      });
    }
  }

  static async checkStorageSpace() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          percentage: (estimate.usage / estimate.quota) * 100
        };
      } catch (error) {
        console.error('Failed to check storage:', error);
        return null;
      }
    }
    return null;
  }
}