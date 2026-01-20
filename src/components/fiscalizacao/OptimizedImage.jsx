import React, { useState, useEffect } from 'react';
import { getCachedImage, cacheImage } from '@/components/offline/offlineStorage.js';

export default function OptimizedImage({ src, alt, className, ...props }) {
    const [imgSrc, setImgSrc] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const loadImage = async () => {
            if (!src) return;
            
            try {
                // Tentar cache primeiro
                const cached = await getCachedImage(src);
                if (cached && isMounted) {
                    const objectUrl = URL.createObjectURL(cached.blob);
                    setImgSrc(objectUrl);
                    setIsLoading(false);
                    return;
                }
                
                // Se não está em cache, baixar
                const response = await fetch(src);
                const blob = await response.blob();
                
                // Armazenar em cache
                await cacheImage(src, blob);
                
                if (isMounted) {
                    const objectUrl = URL.createObjectURL(blob);
                    setImgSrc(objectUrl);
                    setIsLoading(false);
                }
            } catch (error) {
                // Fallback para URL original
                if (isMounted) {
                    setImgSrc(src);
                    setIsLoading(false);
                }
            }
        };
        
        loadImage();
        
        return () => {
            isMounted = false;
            if (imgSrc && imgSrc.startsWith('blob:')) {
                URL.revokeObjectURL(imgSrc);
            }
        };
    }, [src]);

    if (isLoading || !imgSrc) {
        return (
            <div className={`bg-gray-200 animate-pulse ${className}`} {...props} />
        );
    }

    return (
        <img 
            src={imgSrc} 
            alt={alt} 
            className={className}
            loading="lazy"
            {...props}
        />
    );
}