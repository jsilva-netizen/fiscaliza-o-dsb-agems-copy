import { useEffect, useState } from 'react';

export function useBackgroundSync() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if Background Sync API is supported
    const supported = 'serviceWorker' in navigator && 'SyncManager' in window;
    setIsSupported(supported);
  }, []);

  const register = async (tag) => {
    if (!isSupported) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      return true;
    } catch (error) {
      console.error('Failed to register background sync:', error);
      return false;
    }
  };

  return {
    isSupported,
    register
  };
}