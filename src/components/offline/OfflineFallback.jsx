import React, { useState, useEffect } from 'react';
import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function OfflineFallback() {
  const [hasCachedData, setHasCachedData] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkCachedData = async () => {
      try {
        // Tenta abrir o IndexedDB
        const dbRequest = indexedDB.open('FiscalizacaoOfflineDB');
        
        dbRequest.onsuccess = async (event) => {
          const db = event.target.result;
          const objectStoreNames = db.objectStoreNames;
          
          // Verifica se existem dados em qualquer tabela
          let hasData = false;
          
          for (let i = 0; i < objectStoreNames.length; i++) {
            const storeName = objectStoreNames[i];
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
              if (request.result.length > 0) {
                hasData = true;
              }
            };
          }
          
          // Pequeno delay para garantir que completou as verificações
          setTimeout(() => {
            setHasCachedData(hasData);
            setIsChecking(false);
          }, 500);
        };
        
        dbRequest.onerror = () => {
          setHasCachedData(false);
          setIsChecking(false);
        };
      } catch (error) {
        console.error('[OfflineFallback] Erro ao verificar cache:', error);
        setHasCachedData(false);
        setIsChecking(false);
      }
    };

    checkCachedData();
  }, []);

  const handleRetry = () => {
    setIsChecking(true);
    // Aguarda conexão
    if (navigator.onLine) {
      window.location.reload();
    } else {
      setTimeout(() => {
        if (navigator.onLine) {
          window.location.reload();
        } else {
          setIsChecking(false);
        }
      }, 2000);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-sm">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Verificando dados...</h2>
            <p className="text-sm text-gray-600">Aguarde um momento</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="max-w-sm w-full">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <CloudOff className="h-16 w-16 text-amber-500 mx-auto opacity-70" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sem conexão</h1>
          <p className="text-gray-600 mb-6">
            {hasCachedData 
              ? 'Você está offline, mas seus dados estão disponíveis.'
              : 'Você está offline e não há dados em cache para carregar.'
            }
          </p>

          {hasCachedData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900">
                ✓ Dados offline disponíveis<br />
                Você pode continuar trabalhando e os dados serão sincronizados quando reconectar.
              </p>
            </div>
          )}

          {!hasCachedData && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-900">
                ⚠ Nenhum dado em cache<br />
                Conecte à internet e recarregue para carregar os dados iniciais.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 h-10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {navigator.onLine ? 'Recarregar' : 'Aguardando conexão...'}
            </Button>
            
            {hasCachedData && (
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full h-10"
              >
                Continuar Offline
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Status: <strong>{navigator.onLine ? '🟢 Online' : '🔴 Offline'}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}