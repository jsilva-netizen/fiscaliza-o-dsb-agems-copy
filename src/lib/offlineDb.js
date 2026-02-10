import Dexie from 'dexie';

console.log('>>> [OFFLINE DB] Inicializando IndexedDB com Dexie...');

let db = null;
let dbInitialized = false;
let initializationPromise = null;

// Verificar disponibilidade do IndexedDB
const checkIndexedDBAvailable = async () => {
  try {
    const testDb = new Dexie('__test__' + Date.now());
    await testDb.open();
    await testDb.close();
    await testDb.delete();
    console.log('>>> [OFFLINE DB] ✓ IndexedDB disponível');
    return true;
  } catch (e) {
    console.warn('>>> [OFFLINE DB] ⚠️ IndexedDB não disponível:', e.message);
    return false;
  }
};

// Fallback para localStorage
const createLocalStorageFallback = () => {
  console.log('>>> [OFFLINE DB] Usando localStorage como fallback');
  const prefix = 'agems_';

  return {
    isOpen: () => true,
    open: async function() { return this; },
    close: async function() {},
    
    table: (tableName) => ({
      add: async (data) => {
        localStorage.setItem(prefix + tableName + ':' + data.id, JSON.stringify(data));
        return data.id;
      },
      put: async (data) => {
        localStorage.setItem(prefix + tableName + ':' + data.id, JSON.stringify(data));
        return data.id;
      },
      get: async (id) => {
        const data = localStorage.getItem(prefix + tableName + ':' + id);
        return data ? JSON.parse(data) : undefined;
      },
      delete: async (id) => {
        localStorage.removeItem(prefix + tableName + ':' + id);
      },
      clear: async () => {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(prefix + tableName)) localStorage.removeItem(key);
        });
      },
      toArray: async () => {
        return Object.keys(localStorage)
          .filter(key => key.startsWith(prefix + tableName + ':'))
          .map(key => JSON.parse(localStorage.getItem(key)));
      },
      where: (field) => ({
        equals: (value) => ({
          toArray: async () => {
            return Object.keys(localStorage)
              .filter(key => key.startsWith(prefix + tableName + ':'))
              .map(key => JSON.parse(localStorage.getItem(key)))
              .filter(item => item[field] === value);
          },
          count: async () => {
            return Object.keys(localStorage)
              .filter(key => key.startsWith(prefix + tableName + ':'))
              .map(key => JSON.parse(localStorage.getItem(key)))
              .filter(item => item[field] === value).length;
          }
        })
      }),
      count: async () => {
        return Object.keys(localStorage).filter(key => key.startsWith(prefix + tableName + ':')).length;
      },
      bulkPut: async (items) => {
        items.forEach(item => {
          localStorage.setItem(prefix + tableName + ':' + item.id, JSON.stringify(item));
        });
        return items.length;
      }
    })
  };
};

// Inicializar banco de dados
const initializeDatabase = async () => {
  if (dbInitialized) return db;

  const hasIndexedDB = await checkIndexedDBAvailable();

  if (hasIndexedDB) {
    // Usar Dexie/IndexedDB
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
    console.log('>>> [OFFLINE DB] ✓✓✓ Dexie/IndexedDB inicializado com sucesso!');
  } else {
    // Usar fallback localStorage
    db = createLocalStorageFallback();
    await db.open();
    console.warn('>>> [OFFLINE DB] ⚠️ Usando localStorage (IndexedDB indisponível)');
  }
  
  dbInitialized = true;
  return db;
};

// Iniciar inicialização
initializationPromise = initializeDatabase();

// Export da Promise de inicialização
export const dbReady = initializationPromise;

// Wrapper para acesso às tabelas
const dbWrapper = {
  get municipios() { return db?.municipios || db?.table('municipios'); },
  get prestadores_servico() { return db?.prestadores_servico || db?.table('prestadores_servico'); },
  get tipos_unidade() { return db?.tipos_unidade || db?.table('tipos_unidade'); },
  get item_checklist() { return db?.item_checklist || db?.table('item_checklist'); },
  get fiscalizacoes() { return db?.fiscalizacoes || db?.table('fiscalizacoes'); },
  get unidades_fiscalizadas() { return db?.unidades_fiscalizadas || db?.table('unidades_fiscalizadas'); },
  get respostas_checklist() { return db?.respostas_checklist || db?.table('respostas_checklist'); },
  get nao_conformidades() { return db?.nao_conformidades || db?.table('nao_conformidades'); },
  get determinacoes() { return db?.determinacoes || db?.table('determinacoes'); },
  get recomendacoes() { return db?.recomendacoes || db?.table('recomendacoes'); },
  get constatacoes_manuais() { return db?.constatacoes_manuais || db?.table('constatacoes_manuais'); },
  get fotos() { return db?.fotos || db?.table('fotos'); },
  get syncQueue() { return db?.syncQueue || db?.table('syncQueue'); },
  get idMappings() { return db?.idMappings || db?.table('idMappings'); },
  get syncMeta() { return db?.syncMeta || db?.table('syncMeta'); },
  
  isOpen: () => db?.isOpen?.() || false,
  open: async () => { await initializationPromise; return dbWrapper; },
  close: async () => { if (db) await db.close(); },
  table: (name) => db?.table?.(name),
  ready: dbReady
};

export default dbWrapper;
