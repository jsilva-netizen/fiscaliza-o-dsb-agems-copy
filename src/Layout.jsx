import React from 'react';
import StatusBar from '@/components/offline/StatusBar';
import PushNotificationInitializer from '@/components/offline/PushNotificationInitializer';
import NotificationListener from '@/components/offline/NotificationListener';
import { useInitializeReferenceData } from '@/components/hooks/useInitializeReferenceData';

export default function Layout({ children, currentPageName }) {
    useInitializeReferenceData();

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
                <StatusBar />
                {children}
            </>
        );
    }

    return (
        <>
            <PushNotificationInitializer />
            <NotificationListener />
            <div className="pb-16">
                {children}
            </div>
            <StatusBar />
        </>
    );
}