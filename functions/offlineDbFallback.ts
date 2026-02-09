import Dexie from 'dexie';

console.log('>>> [OFFLINE DB FALLBACK] Inicializando com suporte a fallback...');

let db = null;
let useIndexedDB = false;
let useLocalStorage = false;

// Tentar inicializar Dexie/IndexedDB
const initDexie = async () => {
  try {
    const testDb = new Dexie('__test__' + Date.now());
    await testDb.open();
    testDb.close();
    console.log('>>> [OFFLINE DB] ✓ IndexedDB disponível');
    useIndexedDB = true;
    return true;
  } catch (e) {
    console.warn('>>> [OFFLINE DB] IndexedDB não disponível:', e.message);
    return false;
  }
};

// Fallback para localStorage
const createLocalStorageFallback = () => {
  console.log('>>> [OFFLINE DB] Usando localStorage como fallback');
  useLocalStorage = true;

  const prefix = 'agems_';

  return {
    isOpen: () => true,
    
    open: async () => {
      console.log('>>> [OFFLINE DB FALLBACK] Fallback localStorage aberto');
      return this;
    },

    close: async () => {
      console.log('>>> [OFFLINE DB FALLBACK] Fallback localStorage fechado');
    },

    table: (tableName) => ({
      add: async (data) => {
        const key = prefix + tableName + ':' + data.id;
        localStorage.setItem(key, JSON.stringify(data));
        return data.id;
      },

      put: async (data) => {
        const key = prefix + tableName + ':' + data.id;
        localStorage.setItem(key, JSON.stringify(data));
        return data.id;
      },

      get: async (id) => {
        const key = prefix + tableName + ':' + id;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : undefined;
      },

      delete: async (id) => {
        const key = prefix + tableName + ':' + id;
        localStorage.removeItem(key);
      },

      clear: async () => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(prefix + tableName)) {
            localStorage.removeItem(key);
          }
        });
      },

      toArray: async () => {
        const keys = Object.keys(localStorage);
        return keys
          .filter(key => key.startsWith(prefix + tableName + ':'))
          .map(key => JSON.parse(localStorage.getItem(key)));
      },

      where: (field) => ({
        equals: (value) => ({
          toArray: async () => {
            const keys = Object.keys(localStorage);
            return keys
              .filter(key => key.startsWith(prefix + tableName + ':'))
              .map(key => JSON.parse(localStorage.getItem(key)))
              .filter(item => item[field] === value);
          },

          count: async () => {
            const keys = Object.keys(localStorage);
            return keys
              .filter(key => key.startsWith(prefix + tableName + ':'))
              .map(key => JSON.parse(localStorage.getItem(key)))
              .filter(item => item[field] === value).length;
          }
        })
      }),

      count: async () => {
        const keys = Object.keys(localStorage);
        return keys.filter(key => key.startsWith(prefix + tableName + ':')).length;
      },

      bulkPut: async (items) => {
        items.forEach(item => {
          const key = prefix + tableName + ':' + item.id;
          localStorage.setItem(key, JSON.stringify(item));
        });
        return items.length;
      }
    }),

    tables: {},
    on: (event, callback) => {
      if (event === 'ready') {
        setTimeout(() => callback(), 100);
      }
    }
  };
};

// Inicializar
(async () => {
  const hasIndexedDB = await initDexie();

  if (hasIndexedDB) {
    // Usar Dexie real
    db = new Dexie('AgemsFiscalizacaoOffline');

    db.version(10).stores({
      municipios: 'id, nome',
      prestadores_servico: 'id, nome, ativo',
      tipos_unidade: 'id, nome',
      item_checklist: 'id, tipo_unidade_id, ordem',
      fiscalizacoes: 'id, status, municipio_id, fiscal_email, _syncStatus, _localId',
      unidades_fiscalizadas: 'id, fiscalizacao_id, tipo_unidade_id, status, _syncStatus, _localId',
      respostas_checklist: 'id, unidade_fiscalizada_id, item_checklist_id, _syncStatus, _localId',
      nao_conformidades: 'id, unidade_fiscalizada_id, numero_nc, _syncStatus, _localId',
      determinacoes: 'id, unidade_fiscalizada_id, nao_conformidade_id, _syncStatus, _localId',
      recomendacoes: 'id, unidade_fiscalizada_id, numero_recomendacao, _syncStatus, _localId',
      constatacoes_manuais: 'id, unidade_fiscalizada_id, ordem, _syncStatus, _localId',
      fotos: '++autoId, entityType, entityId, _syncStatus',
      syncQueue: '++id, operation, entityName, localId, timestamp, status',
      idMappings: 'localId, remoteId, entityName',
      syncMeta: 'key'
    });

    await db.open();
    console.log('>>> [OFFLINE DB] Dexie/IndexedDB inicializado com sucesso');
  } else {
    // Usar fallback localStorage
    db = createLocalStorageFallback();
    await db.open();
    console.warn('>>> [OFFLINE DB] ⚠️ IndexedDB indisponível - usando localStorage (capacidade limitada)');
    
    // Avisar usuário
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-db:fallback-mode', {
        detail: { mode: 'localStorage', message: 'Usando armazenamento local limitado' }
      }));
    }
  }
})();

export default db;