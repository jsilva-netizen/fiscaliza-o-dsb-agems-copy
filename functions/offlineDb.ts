import Dexie from 'dexie';

console.log('>>> [OFFLINE DB] Verificando suporte a IndexedDB...');

// Detectar se IndexedDB está disponível
const checkIndexedDBSupport = () => {
  try {
    // Verificar se o objeto indexedDB existe
    if (!indexedDB) {
      console.warn('>>> [OFFLINE DB] indexedDB não está disponível (undefined)');
      return false;
    }

    // Tentar abrir um banco de testes
    const test = indexedDB.open('__test__' + Date.now());
    
    test.onsuccess = () => {
      console.log('>>> [OFFLINE DB] ✓ IndexedDB disponível e funcional');
      indexedDB.deleteDatabase('__test__');
    };

    test.onerror = () => {
      console.warn('>>> [OFFLINE DB] IndexedDB bloqueado ou indisponível');
    };

    test.onblocked = () => {
      console.warn('>>> [OFFLINE DB] IndexedDB bloqueado');
    };

    return true;
  } catch (e) {
    console.error('>>> [OFFLINE DB] Erro ao detectar IndexedDB:', e.message);
    return false;
  }
};

const isSupported = checkIndexedDBSupport();

export const db = new Dexie('AgemsFiscalizacaoOffline');

// Configurar schema com tolerância a erros
try {
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

  console.log('>>> [OFFLINE DB] Schema configurado com sucesso');
} catch (e) {
  console.error('>>> [OFFLINE DB] Erro ao configurar schema:', e);
}

// Hooks
db.on('ready', () => {
  console.log('>>> [OFFLINE DB] ✓ Banco pronto para uso');
});

db.on('error', (error) => {
  console.error('>>> [OFFLINE DB] ✗ Erro:', error.message);
});

// Abrir banco imediatamente
if (isSupported) {
  db.open()
    .then(() => {
      console.log('>>> [OFFLINE DB] ✓ Banco aberto com sucesso');
    })
    .catch((error) => {
      console.error('>>> [OFFLINE DB] ✗ Falha ao abrir banco:', error.message);
    });
} else {
  console.warn('>>> [OFFLINE DB] IndexedDB não suportado - usando modo degradado (apenas memória)');
}

// Propriedade auxiliar para verificar estado
db.isIndexedDBSupported = () => isSupported;

export default db;