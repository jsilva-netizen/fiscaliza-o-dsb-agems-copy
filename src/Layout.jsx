import React, { useState, useEffect } from 'react';
import OfflineStatusBar from '@/components/offline/OfflineStatusBar';
import OfflineSyncButton from '@/components/offline/OfflineSyncButton';
import PushNotificationInitializer from '@/components/offline/PushNotificationInitializer';
import NotificationListener from '@/components/offline/NotificationListener';
import OfflineFallback from '@/components/offline/OfflineFallback';
import { useInitializeReferenceData } from '@/components/hooks/useInitializeReferenceData';

export default function Layout({ children, currentPageName }) {
    const [isInitialized, setIsInitialized] = useState(false);
    useInitializeReferenceData();
    
    useEffect(() => {
        // Marca como inicializado após render inicial
        setIsInitialized(true);
    }, []);

    // Mostra fallback offline se: offline, não está na primeira renderização, e página requer dados
    const requiresData = ['Home', 'NovaFiscalizacao', 'Fiscalizacoes', 'Municipios', 'TiposUnidade'].includes(currentPageName);
    if (!navigator.onLine && isInitialized && requiresData) {
        return <OfflineFallback />;
    }

    // Páginas que não precisam de layout (fullscreen)
    const fullscreenPages = [
        'Home', 
        'NovaFiscalizacao', 
        'ExecutarFiscalizacao', 
        'VistoriarUnidade',
        'AdicionarUnidade',
        'Municipios',
        'TiposUnidade',
        'Checklists',
        'Fiscalizacoes',
        'Relatorios'
    ];

    if (fullscreenPages.includes(currentPageName)) {
        return (
            <>
                <PushNotificationInitializer />
                <NotificationListener />
                <OfflineStatusBar />
                <div className="fixed top-4 right-4 z-50">
                    <OfflineSyncButton />
                </div>
                {children}
            </>
        );
    }

    return (
        <>
            <PushNotificationInitializer />
            <NotificationListener />
            <OfflineStatusBar />
            <div className="fixed top-4 right-4 z-50">
                <OfflineSyncButton />
            </div>
            <div className="min-h-screen bg-gray-50">
                {children}
            </div>
        </>
    );
}