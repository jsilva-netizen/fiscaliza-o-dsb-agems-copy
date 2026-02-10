import { base44 } from '@/api/base44Client';
import db from './offlineDb';

/**
 * DataService - Camada de abstração para dados offline/online
 * Roteia requisições entre Base44 SDK (online) e Dexie (offline)
 */
class DataServiceClass {
  constructor() {
    this.isOnline = navigator.onLine;
    this.entityMappings = {
      'Municipio': { local: 'municipios', remote: 'Municipio' },
      'TipoUnidade': { local: 'tipos_unidade', remote: 'TipoUnidade' },
      'PrestadorServico': { local: 'prestadores_servico', remote: 'PrestadorServico' },
      'ItemChecklist': { local: 'item_checklist', remote: 'ItemChecklist' },
      'Fiscalizacao': { local: 'fiscalizacoes', remote: 'Fiscalizacao' },
      'UnidadeFiscalizada': { local: 'unidades_fiscalizadas', remote: 'UnidadeFiscalizada' },
      'RespostaChecklist': { local: 'respostas_checklist', remote: 'RespostaChecklist' },
      'NaoConformidade': { local: 'nao_conformidades', remote: 'NaoConformidade' },
      'ConstatacaoManual': { local: 'constatacoes_manuais', remote: 'ConstatacaoManual' },
      'Determinacao': { local: 'determinacoes', remote: 'Determinacao' },
      'Recomendacao': { local: 'recomendacoes', remote: 'Recomendacao' },
      'AutoInfracao': { local: 'autos_infracao', remote: 'AutoInfracao' },
    };

    this.setupOnlineListeners();
  }

  setupOnlineListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      window.dispatchEvent(new CustomEvent('data-service-online'));
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      window.dispatchEvent(new CustomEvent('data-service-offline'));
    });
  }

  // ========== MÉTODOS GENÉRICOS ==========

  /**
   * Lê dados - tenta online primeiro, fallback para local
   */
  async read(entityName, filter = {}, sort = '-created_date', limit = 100) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} not mapped`);

    try {
      // Tenta online
      if (this.isOnline) {
        const data = await base44.entities[entityName].filter(filter, sort, limit);
        // Atualiza cache local em background
        this.cacheToLocal(entityName, data);
        return data;
      }
    } catch (err) {
      console.warn(`Failed to fetch ${entityName} online:`, err);
    }

    // Fallback: dados locais
    return this.readLocal(entityName, filter);
  }

  /**
   * Cria novo registro - salva localmente e marca para sync
   */
  async create(entityName, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} not mapped`);

    let result;

    // Se online, cria no servidor
    if (this.isOnline) {
      try {
        result = await base44.entities[entityName].create(data);
        // Atualiza cache local
        await db[mapping.local].put(result);
        return result;
      } catch (err) {
        console.error(`Failed to create ${entityName} online:`, err);
        // Fallback: salva localmente e marca para sync
      }
    }

    // Salva localmente com ID temporário
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    result = {
      id: tempId,
      ...data,
      _pending: true,
      _syncError: null
    };

    await db[mapping.local].put(result);
    await this.addToSyncQueue('create', entityName, result);

    return result;
  }

  /**
   * Atualiza registro
   */
  async update(entityName, id, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} not mapped`);

    const isRemote = !id.toString().startsWith('temp_');

    if (this.isOnline && isRemote) {
      try {
        const result = await base44.entities[entityName].update(id, data);
        await db[mapping.local].put(result);
        return result;
      } catch (err) {
        console.error(`Failed to update ${entityName} online:`, err);
      }
    }

    // Atualiza localmente
    const current = await db[mapping.local].get(id);
    const updated = { ...current, ...data, _pending: !isRemote, _syncError: null };
    await db[mapping.local].put(updated);
    await this.addToSyncQueue('update', entityName, updated);

    return updated;
  }

  /**
   * Deleta registro
   */
  async delete(entityName, id) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} not mapped`);

    const isRemote = !id.toString().startsWith('temp_');

    if (this.isOnline && isRemote) {
      try {
        await base44.entities[entityName].delete(id);
        await db[mapping.local].delete(id);
        return;
      } catch (err) {
        console.error(`Failed to delete ${entityName} online:`, err);
      }
    }

    // Marca para deleção offline
    await db[mapping.local].delete(id);
    await this.addToSyncQueue('delete', entityName, { id });
  }

  /**
   * Lê dados apenas do cache local
   */
  async readLocal(entityName, filter = {}) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) return [];

    let results = await db[mapping.local].toArray();

    // Aplica filtro simples
    Object.entries(filter).forEach(([key, value]) => {
      results = results.filter(item => item[key] === value);
    });

    return results;
  }

  /**
   * Atualiza cache local com dados do servidor
   */
  async cacheToLocal(entityName, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) return;

    if (!Array.isArray(data)) data = [data];

    try {
      await db[mapping.local].bulkPut(data.map(item => ({
        ...item,
        _pending: false,
        _syncError: null
      })));
    } catch (err) {
      console.warn(`Failed to cache ${entityName}:`, err);
    }
  }

  /**
   * Adiciona à fila de sincronização
   */
  async addToSyncQueue(operation, entityName, data) {
    await db.syncQueue.add({
      operation,
      entityName,
      data: JSON.stringify(data),
      timestamp: new Date(),
      attempts: 0,
      status: 'pending'
    });
  }

  /**
   * Obtém registros pendentes de sincronização
   */
  async getPending(entityName = null) {
    let pending = await db.syncQueue.toArray();

    if (entityName) {
      pending = pending.filter(item => item.entityName === entityName);
    }

    return pending.filter(item => item.status === 'pending');
  }

  /**
   * Limpa cache local
   */
  async clearCache(entityName = null) {
    if (entityName) {
      const mapping = this.entityMappings[entityName];
      if (mapping) await db[mapping.local].clear();
    } else {
      await Promise.all(
        Object.values(this.entityMappings).map(m => db[m.local].clear())
      );
    }
  }

  /**
   * Retorna status de sincronização
   */
  async getSyncStatus() {
    const pending = await db.syncQueue.where('status').equals('pending').count();
    const failed = await db.syncQueue.where('status').equals('failed').count();
    
    return {
      pendingCount: pending,
      failedCount: failed,
      isOnline: this.isOnline
    };
  }

  // ========== MÉTODOS ESPECÍFICOS POR ENTIDADE ==========

  // Municípios
  async getMunicipios() {
    return this.read('Municipio', {}, 'nome', 100);
  }

  async getMunicipioById(id) {
    const mapping = this.entityMappings['Municipio'];
    return await db[mapping.local].get(id);
  }

  // Prestadores de Serviço
  async getPrestadores() {
    return this.read('PrestadorServico', {}, 'nome', 200);
  }

  async savePrestador(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('PrestadorServico', data.id, data);
    }
    return this.create('PrestadorServico', data);
  }

  async deletePrestador(id) {
    return this.delete('PrestadorServico', id);
  }

  // Tipos de Unidade
  async getTiposUnidade() {
    return this.read('TipoUnidade', {}, 'nome', 100);
  }

  async getTipoUnidadeById(id) {
    const mapping = this.entityMappings['TipoUnidade'];
    return await db[mapping.local].get(id);
  }

  // Itens de Checklist
  async getItemsChecklist(tipoUnidadeId = null) {
    const filter = tipoUnidadeId ? { tipo_unidade_id: tipoUnidadeId } : {};
    return this.read('ItemChecklist', filter, 'ordem', 500);
  }

  // Fiscalizações
  async getFiscalizacoes() {
    return this.read('Fiscalizacao', {}, '-data_inicio', 500);
  }

  async getFiscalizacaoById(id) {
    const mapping = this.entityMappings['Fiscalizacao'];
    return await db[mapping.local].get(id);
  }

  async saveFiscalizacao(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('Fiscalizacao', data.id, data);
    }
    return this.create('Fiscalizacao', data);
  }

  // Unidades Fiscalizadas
  async getUnidades(fiscalizacaoId = null) {
    const filter = fiscalizacaoId ? { fiscalizacao_id: fiscalizacaoId } : {};
    return this.read('UnidadeFiscalizada', filter, '-created_date', 500);
  }

  async getUnidadeById(id) {
    const mapping = this.entityMappings['UnidadeFiscalizada'];
    return await db[mapping.local].get(id);
  }

  async saveUnidade(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('UnidadeFiscalizada', data.id, data);
    }
    return this.create('UnidadeFiscalizada', data);
  }

  async deleteUnidade(id) {
    return this.delete('UnidadeFiscalizada', id);
  }

  // Respostas de Checklist
  async getRespostasChecklist(unidadeId) {
    return this.read('RespostaChecklist', { unidade_fiscalizada_id: unidadeId }, 'id', 500);
  }

  async saveRespostaChecklist(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('RespostaChecklist', data.id, data);
    }
    return this.create('RespostaChecklist', data);
  }

  // Não Conformidades
  async getNaoConformidades(unidadeId = null) {
    const filter = unidadeId ? { unidade_fiscalizada_id: unidadeId } : {};
    return this.read('NaoConformidade', filter, '-created_date', 500);
  }

  async saveNaoConformidade(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('NaoConformidade', data.id, data);
    }
    return this.create('NaoConformidade', data);
  }

  async deleteNaoConformidade(id) {
    return this.delete('NaoConformidade', id);
  }

  // Constatações Manuais
  async getConstatacoesManuais(unidadeId) {
    return this.read('ConstatacaoManual', { unidade_fiscalizada_id: unidadeId }, 'ordem', 500);
  }

  async saveConstatacaoManual(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('ConstatacaoManual', data.id, data);
    }
    return this.create('ConstatacaoManual', data);
  }

  async deleteConstatacaoManual(id) {
    return this.delete('ConstatacaoManual', id);
  }

  // Determinações
  async getDeterminacoes(unidadeId = null) {
    const filter = unidadeId ? { unidade_fiscalizada_id: unidadeId } : {};
    return this.read('Determinacao', filter, '-created_date', 500);
  }

  async saveDeterminacao(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('Determinacao', data.id, data);
    }
    return this.create('Determinacao', data);
  }

  // Recomendações
  async getRecomendacoes(unidadeId = null) {
    const filter = unidadeId ? { unidade_fiscalizada_id: unidadeId } : {};
    return this.read('Recomendacao', filter, '-created_date', 500);
  }

  async saveRecomendacao(data) {
    if (data.id && !data.id.toString().startsWith('temp_')) {
      return this.update('Recomendacao', data.id, data);
    }
    return this.create('Recomendacao', data);
  }

  async deleteRecomendacao(id) {
    return this.delete('Recomendacao', id);
  }

  // Autos de Infração
  async getAutosInfracao(fiscalizacaoId = null) {
    const filter = fiscalizacaoId ? { fiscalizacao_id: fiscalizacaoId } : {};
    return this.read('AutoInfracao', filter, '-created_date', 500);
  }
}

const DataService = new DataServiceClass();
export default DataService;