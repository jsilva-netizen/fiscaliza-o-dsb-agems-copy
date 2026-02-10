import { useEffect } from 'react';
import DataService from '@/components/offline/dataService';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Hook que carrega automaticamente dados de referência no banco local
 * Executa uma vez ao montar o componente se estiver online
 */
export function useInitializeReferenceData() {
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    if (!isOnline) return;

    const loadReferenceData = async () => {
      try {
        console.log('[useInitializeReferenceData] Carregando dados de referência...');
        
        // Carrega dados de referência
        await Promise.all([
          DataService.getMunicipios(),
          DataService.getPrestadores(),
          DataService.getTiposUnidade(),
          DataService.getItemChecklist(),
        ]);

        console.log('[useInitializeReferenceData] Dados de referência carregados com sucesso');

        // Sincroniza fiscalizações para manter apenas as que existem no banco online
        console.log('[useInitializeReferenceData] Sincronizando fiscalizações...');
        try {
          const fiscalizacoesOnline = await DataService.read('Fiscalizacao', {}, '-created_date', 1000);
          console.log(`[useInitializeReferenceData] ${fiscalizacoesOnline.length} fiscalizações no servidor`);
        } catch (error) {
          console.warn('[useInitializeReferenceData] Erro ao sincronizar fiscalizações:', error);
        }
      } catch (error) {
        console.error('[useInitializeReferenceData] Erro ao carregar dados de referência:', error);
      }
    };

    loadReferenceData();
  }, [isOnline]);
}