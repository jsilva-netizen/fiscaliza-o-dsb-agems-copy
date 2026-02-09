import { base44 } from '@/api/base44Client';
import db from '@/functions/offlineDb';
import { DataService } from './DataService';

/**
 * SyncService - Gerencia sincronização de dados offline para online
 * Processa fila de sincronização e resolve conflitos
 */
class SyncServiceClass {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.maxRetries = 3;
    this.batchSize = 10;
    this.retryDelay = 5000; // 5 segundos
  }

  /**
   * Inicia sincronização automática
   */
  startAutoSync(intervalMs = 30000) {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncAll();
      }
    }, intervalMs);
  }

  /**
   * Para sincronização automática
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sincroniza tudo
   */
  async syncAll() {
    if (this.isSyncing || !navigator.onLine) return;

    this.isSyncing = true;
    window.dispatchEvent(new CustomEvent('sync-started'));

    try {
      if (!db || !db.syncQueue) {
        this.isSyncing = false;
        return;
      }
      const pending = await db.syncQueue.toArray();
      const byEntity = this.groupByEntity(pending);

      let successCount = 0;
      let errorCount = 0;

      for (const [entityName, operations] of Object.entries(byEntity)) {
        const batches = this.createBatches(operations, this.batchSize);

        for (const batch of batches) {
          try {
            await Promise.all(batch.map(item => this.processSyncItem(item)));
            successCount += batch.length;
          } catch (err) {
            console.error(`Batch sync error for ${entityName}:`, err);
            errorCount += batch.length;
          }
        }
      }

      // Notifica resultado
      this.dispatchSyncEvent('success', {
        successCount,
        errorCount,
        timestamp: new Date()
      });

      // Persiste tempo de último sync
      localStorage.setItem('lastSyncTime', new Date().toISOString());

    } catch (err) {
      console.error('Sync error:', err);
      this.dispatchSyncEvent('error', { message: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Processa item individual da fila
   */
  async processSyncItem(syncItem) {
    const { id, operation, entityName, data, attempts } = syncItem;
    const payload = JSON.parse(data);

    try {
      // Atualiza status para processando
      await db.syncQueue.update(id, { status: 'processing' });

      switch (operation) {
        case 'create':
          await this.syncCreate(entityName, payload);
          break;
        case 'update':
          await this.syncUpdate(entityName, payload);
          break;
        case 'delete':
          await this.syncDelete(entityName, payload);
          break;
      }

      // Remove da fila se sucesso
      await db.syncQueue.delete(id);
      
    } catch (err) {
      const newAttempts = attempts + 1;

      if (newAttempts >= this.maxRetries) {
        // Falha permanente
        await db.syncQueue.update(id, {
          status: 'failed',
          attempts: newAttempts,
          error: err.message
        });
        throw err;
      } else {
        // Retry
        await db.syncQueue.update(id, {
          status: 'pending',
          attempts: newAttempts,
          lastError: err.message
        });
        throw err;
      }
    }
  }

  /**
   * Sincroniza criação (temp_id -> remote_id)
   */
  async syncCreate(entityName, payload) {
    const { id, _pending, _syncError, ...createData } = payload;

    const result = await base44.entities[entityName].create(createData);

    // Atualiza local com ID remoto
    const mapping = DataService.entityMappings[entityName];
    if (mapping) {
      await db[mapping.local].delete(id);
      await db[mapping.local].put({
        ...result,
        _pending: false,
        _syncError: null
      });
    }

    // Atualiza mapeamento de IDs
    await db.idMappings.put({
      localId: id,
      remoteId: result.id,
      entityName,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Sincroniza atualização
   */
  async syncUpdate(entityName, payload) {
    const { id, _pending, _syncError, ...updateData } = payload;

    const result = await base44.entities[entityName].update(id, updateData);

    const mapping = DataService.entityMappings[entityName];
    if (mapping) {
      await db[mapping.local].put({
        ...result,
        _pending: false,
        _syncError: null
      });
    }

    return result;
  }

  /**
   * Sincroniza deleção
   */
  async syncDelete(entityName, payload) {
    const { id } = payload;

    await base44.entities[entityName].delete(id);

    const mapping = DataService.entityMappings[entityName];
    if (mapping) {
      await db[mapping.local].delete(id);
    }
  }

  /**
   * Agrupa items por entity
   */
  groupByEntity(items) {
    return items.reduce((acc, item) => {
      if (!acc[item.entityName]) acc[item.entityName] = [];
      acc[item.entityName].push(item);
      return acc;
    }, {});
  }

  /**
   * Cria batches de items
   */
  createBatches(items, size) {
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  /**
   * Retorna status de sincronização
   */
  async getSyncStatus() {
    try {
      if (!db || !db.syncQueue) {
        return {
          isSyncing: this.isSyncing,
          pendingCount: 0,
          failedCount: 0,
          lastSyncTime: null,
          hasErrors: false
        };
      }
      const pending = await db.syncQueue.where('status').equals('pending').toArray();
      const failed = await db.syncQueue.where('status').equals('failed').toArray();
      const lastSync = localStorage.getItem('lastSyncTime');

      return {
        isSyncing: this.isSyncing,
        pendingCount: pending.length,
        failedCount: failed.length,
        lastSyncTime: lastSync ? new Date(lastSync) : null,
        hasErrors: failed.length > 0
      };
    } catch (err) {
      console.warn('Error getting sync status:', err);
      return {
        isSyncing: this.isSyncing,
        pendingCount: 0,
        failedCount: 0,
        lastSyncTime: null,
        hasErrors: false
      };
    }
  }

  /**
    * Retenta sincronização de falhas
    */
  async retryFailed() {
    if (!db || !db.syncQueue) return;
    const failed = await db.syncQueue.where('status').equals('failed').toArray();

    for (const item of failed) {
      await db.syncQueue.update(item.id, {
        status: 'pending',
        attempts: 0
      });
    }

    return this.syncAll();
  }

  /**
   * Limpa fila de sincronização
   */
  async clearQueue() {
    await db.syncQueue.clear();
  }

  /**
   * Dispara evento de sincronização
   */
  dispatchSyncEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent(`sync-${type}`, { detail }));
  }

  /**
   * Força sincronização manual
   */
  async forceSync() {
    if (!navigator.onLine) {
      this.dispatchSyncEvent('error', { message: 'Sem conexão de internet' });
      return;
    }

    return this.syncAll();
  }
}

export const SyncService = new SyncServiceClass();

// Auto-start sync quando online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    SyncService.syncAll();
  });
}