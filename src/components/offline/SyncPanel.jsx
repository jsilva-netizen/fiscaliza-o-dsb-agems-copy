import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Loader2, Download, Upload, Wifi, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import DataService from './dataService';
import db from './offlineDb';

export default function SyncPanel({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Atualiza contagem de pendentes e status online
  useEffect(() => {
    const updateStatus = async () => {
      setIsOnline(navigator.onLine);
      try {
        if (DataService && typeof DataService.getSyncStatus === 'function') {
          const status = await DataService.getSyncStatus();
          setPendingCount(status.pendingCount);
          setFailedCount(status.failedCount);
        }
      } catch (error) {
        console.error('Erro ao atualizar status:', error);
      }
    };

    updateStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOpen]);

  /**
   * Download de dados de referência
   */
  const handleDownload = async () => {
    if (!isOnline) {
      setDownloadStatus({ type: 'error', message: 'Sem conexão de internet' });
      return;
    }

    setIsDownloading(true);
    setDownloadStatus(null);
    setDownloadProgress(0);

    try {
      const result = await DataService.downloadAllReferenceData();

      setDownloadProgress(100);
      
      // Remove completamente o cache e força refetch
      queryClient.removeQueries({ queryKey: ['municipios'] });
      queryClient.removeQueries({ queryKey: ['prestadores'] });
      queryClient.removeQueries({ queryKey: ['tipos_unidade'] });
      queryClient.removeQueries({ queryKey: ['item_checklist'] });
      
      if (result.failed.length === 0) {
        setDownloadStatus({
          type: 'success',
          message: `✓ ${result.success.length} tabelas baixadas (Municípios: ${result.details?.Municipio || 0}, Prestadores: ${result.details?.PrestadorServico || 0})`,
        });
      } else {
        setDownloadStatus({
          type: 'warning',
          message: `⚠ ${result.success.length} sucesso, ${result.failed.length} falharam`,
        });
      }
    } catch (error) {
      setDownloadStatus({
        type: 'error',
        message: `✗ Erro: ${error.message}`,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Upload de dados pendentes
   */
  const handleUpload = async () => {
    if (!isOnline) {
      setUploadStatus({ type: 'error', message: 'Sem conexão de internet' });
      return;
    }

    if (pendingCount === 0) {
      setUploadStatus({
        type: 'info',
        message: 'Nenhum dado pendente para enviar',
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    setUploadProgress(0);

    try {
      const result = await DataService.uploadPendingData();

      const totalProcessed = result.success + result.failed;
      setUploadProgress((result.success / totalProcessed) * 100 || 0);

      if (result.failed === 0) {
        setUploadStatus({
          type: 'success',
          message: `✓ ${result.success} itens sincronizados com sucesso`,
        });
        
        // Limpa e atualiza cache após upload bem-sucedido
        if (result.success > 0) {
          console.log('[SyncPanel] Iniciando refresh do cache...');
          await DataService.clearAndRefreshCache();
          console.log('[SyncPanel] Cache atualizado com sucesso');
        }
        
        // Invalida TODAS as queries para forçar refetch com IDs atualizados
        queryClient.invalidateQueries({ queryKey: ['fiscalizacoes'] });
        queryClient.invalidateQueries({ queryKey: ['fiscalizacao'] });
        queryClient.invalidateQueries({ queryKey: ['unidades-fiscalizacao'] });
        queryClient.invalidateQueries({ queryKey: ['respostas-checklist'] });
        queryClient.invalidateQueries({ queryKey: ['nao-conformidades'] });
        
        // Atualiza contagem
        const updatedStatus = await DataService.getSyncStatus();
        setPendingCount(updatedStatus.pendingCount);
      } else {
        setUploadStatus({
          type: 'warning',
          message: `⚠ ${result.success} sucesso, ${result.failed} falharam`,
        });
      }
      // Atualiza contagem
      if (DataService && typeof DataService.getSyncStatus === 'function') {
        const updatedStatus = await DataService.getSyncStatus();
        setPendingCount(updatedStatus.pendingCount);
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `✗ Erro: ${error.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <h2 className="text-lg font-semibold mb-1">Sincronização</h2>
        
        <p className="text-sm text-gray-600 mb-4">
          {isOnline ? 'Você está online. Escolha o tipo de sincronização.' : 'Você está offline. Conecte-se para sincronizar.'}
        </p>

        <div className="space-y-3">
          {/* Status Conectado */}
          {isOnline && (
            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded">
              <Wifi className="w-4 h-4" />
              <span>Conectado ao servidor</span>
            </div>
          )}

          {/* Botão Download - Azul */}
          <Button
            onClick={handleDownload}
            disabled={!isOnline || isDownloading}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white py-6 flex flex-col items-start justify-start h-auto"
          >
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              <span className="font-semibold">Carregar dados do servidor</span>
            </div>
            <span className="text-xs text-blue-100 ml-7">Municípios, Checklists, etc.</span>
          </Button>

          {/* Botão Upload - Verde */}
          <Button
            onClick={handleUpload}
            disabled={!isOnline || isUploading}
            className="w-full gap-2 bg-green-500 hover:bg-green-600 text-white py-6 flex flex-col items-start justify-start h-auto"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              <span className="font-semibold">Enviar dados para o servidor</span>
            </div>
            <span className="text-xs text-green-100 ml-7">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</span>
          </Button>

          {/* Botão Sincronização Completa - Cinza */}
          <Button
            onClick={async () => {
              await handleDownload();
              await new Promise(r => setTimeout(r, 1000));
              await handleUpload();
            }}
            disabled={!isOnline || isDownloading || isUploading}
            variant="outline"
            className="w-full gap-2 py-6 flex flex-col items-start justify-start h-auto"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              <span className="font-semibold">Sincronização completa</span>
            </div>
            <span className="text-xs text-gray-600 ml-7">Enviar + Receber</span>
          </Button>

          {/* Status Messages */}
          {downloadStatus && (
            <Alert className={`text-sm ${
              downloadStatus.type === 'success' ? 'bg-green-50 border-green-200' :
              downloadStatus.type === 'error' ? 'bg-red-50 border-red-200' :
              'bg-yellow-50 border-yellow-200'
            }`}>
              <AlertDescription>{downloadStatus.message}</AlertDescription>
            </Alert>
          )}
          
          {uploadStatus && (
            <Alert className={`text-sm ${
              uploadStatus.type === 'success' ? 'bg-green-50 border-green-200' :
              uploadStatus.type === 'error' ? 'bg-red-50 border-red-200' :
              'bg-yellow-50 border-yellow-200'
            }`}>
              <AlertDescription>{uploadStatus.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}