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
   * Lê dados - prioriza cache local, sincroniza em background quando online
   */
  async read(entityName, filter = {}, sort = '-created_date', limit = 100) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) throw new Error(`Entity ${entityName} not mapped`);

    console.log(`[DataService.read] Lendo ${entityName}, online=${this.isOnline}, filter=`, filter);

    // SEMPRE lê do cache primeiro (offline-first)
    const cachedData = await this.readLocal(entityName, filter);
    console.log(`[DataService.read] Cache retornou ${cachedData.length} ${entityName}`);
    
    // Se não tem dados no cache e está online, busca do servidor
    if (cachedData.length === 0 && this.isOnline) {
      try {
        console.log(`[DataService.read] Cache vazio, buscando do servidor...`);
        const hasFilter = Object.keys(filter).length > 0;
        const data = hasFilter 
          ? await base44.entities[entityName].filter(filter, sort, limit)
          : await base44.entities[entityName].list(sort, limit);
        
        console.log(`[DataService.read] Servidor retornou ${data.length} ${entityName}`);
        
        // Atualiza cache local
        await this.cacheToLocal(entityName, data);
        return data;
      } catch (err) {
        console.warn(`[DataService.read] Erro ao buscar do servidor:`, err);
      }
    }
    
    // Se online e tem cache, atualiza em background (não bloqueia)
    if (this.isOnline && cachedData.length > 0) {
      this.syncInBackground(entityName, filter, sort, limit);
    }

    console.log(`[DataService.read] Retornando ${cachedData.length} ${entityName} do cache`);
    return cachedData;
  }

  /**
   * Sincroniza dados em background (não bloqueia)
   */
  async syncInBackground(entityName, filter, sort, limit) {
    try {
      const hasFilter = Object.keys(filter).length > 0;
      const data = hasFilter 
        ? await base44.entities[entityName].filter(filter, sort, limit)
        : await base44.entities[entityName].list(sort, limit);
      
      await this.cacheToLocal(entityName, data);
      console.log(`[DataService] Background sync completed for ${entityName}: ${data.length} items`);
    } catch (err) {
      console.warn(`[DataService] Background sync failed for ${entityName}:`, err);
    }
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
    if (!mapping) {
      console.warn(`[DataService.readLocal] Entidade ${entityName} não mapeada`);
      return [];
    }

    try {
      let results = await db[mapping.local].toArray();
      console.log(`[DataService.readLocal] IndexedDB retornou ${results.length} ${entityName}`);

      // Aplica filtro simples
      Object.entries(filter).forEach(([key, value]) => {
        results = results.filter(item => item[key] === value);
      });

      return results;
    } catch (error) {
      console.error(`[DataService.readLocal] Erro ao ler ${entityName} do IndexedDB:`, error);
      return [];
    }
  }

  /**
   * Atualiza cache local com dados do servidor
   */
  async cacheToLocal(entityName, data) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) return;

    if (!Array.isArray(data)) data = [data];

    try {
      console.log(`[DataService.cacheToLocal] Salvando ${data.length} ${entityName} no IndexedDB`);
      await db[mapping.local].bulkPut(data.map(item => ({
        ...item,
        _pending: false,
        _syncError: null
      })));
      console.log(`[DataService.cacheToLocal] ✓ ${data.length} ${entityName} salvos com sucesso`);
    } catch (err) {
      console.error(`[DataService.cacheToLocal] Erro ao salvar ${entityName}:`, err);
    }
  }

  /**
   * Adiciona à fila de sincronização
   */
  async addToSyncQueue(operation, entityName, data) {
    try {
      if (!db.syncQueue) {
        console.warn('[DataService] syncQueue not available');
        return;
      }
      await db.syncQueue.add({
        operation,
        entityName,
        data: JSON.stringify(data),
        timestamp: new Date(),
        attempts: 0,
        status: 'pending'
      });
    } catch (error) {
      console.warn('[DataService] Error adding to sync queue:', error);
    }
  }

  /**
   * Obtém registros pendentes de sincronização
   */
  async getPending(entityName = null) {
    try {
      if (!db.syncQueue) {
        console.warn('[DataService] syncQueue table not initialized');
        return [];
      }

      let pending = await db.syncQueue.toArray();

      if (entityName) {
        pending = pending.filter(item => item.entityName === entityName);
      }

      return pending.filter(item => item.status === 'pending');
    } catch (error) {
      console.warn('[DataService] Error getting pending items:', error);
      return [];
    }
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
    try {
      if (!db.syncQueue) {
        console.warn('[DataService] syncQueue table not initialized');
        return {
          pendingCount: 0,
          failedCount: 0,
          isOnline: this.isOnline
        };
      }

      const allItems = await db.syncQueue.toArray();
      const pending = allItems.filter(item => item.status === 'pending').length;
      const failed = allItems.filter(item => item.status === 'failed').length;
      
      return {
        pendingCount: pending,
        failedCount: failed,
        isOnline: this.isOnline
      };
    } catch (error) {
      console.warn('[DataService] Error getting sync status:', error);
      return {
        pendingCount: 0,
        failedCount: 0,
        isOnline: this.isOnline
      };
    }
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

  async getItemChecklist(tipoUnidadeId = null) {
    return this.getItemsChecklist(tipoUnidadeId);
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

  // Numeração
  async calcularProximaNumeracao(unidadeId) {
    const respostas = await this.getRespostasChecklist(unidadeId);
    const ncs = await this.getNaoConformidades(unidadeId);
    const determinacoes = await this.getDeterminacoes(unidadeId);
    const recomendacoes = await this.getRecomendacoes(unidadeId);
    const constatacoesManuais = await this.getConstatacoesManuais(unidadeId);

    const totalConstatacoes = respostas.filter(r => 
      (r.resposta === 'SIM' || r.resposta === 'NAO') && r.pergunta && r.pergunta.trim()
    ).length + constatacoesManuais.length;

    return {
      C: totalConstatacoes + 1,
      NC: ncs.length + 1,
      D: determinacoes.length + 1,
      R: recomendacoes.length + 1
    };
  }

  // Criação de resposta com NC e determinação
  async createRespostaComNCeDeterminacao(unidadeId, itemId, item, data) {
    const resposta = await this.create('RespostaChecklist', {
      unidade_fiscalizada_id: unidadeId,
      item_checklist_id: itemId,
      pergunta: data.textoConstatacao,
      resposta: data.resposta,
      gera_nc: item.gera_nc,
      numero_constatacao: data.numeroConstatacao,
      observacao: data.observacao
    });

    const nc = await this.create('NaoConformidade', {
      unidade_fiscalizada_id: unidadeId,
      resposta_checklist_id: resposta.id,
      numero_nc: data.numeroNC,
      artigo_portaria: item.artigo_portaria,
      descricao: item.texto_nc || data.textoConstatacao
    });

    if (item.texto_determinacao) {
      await this.create('Determinacao', {
        unidade_fiscalizada_id: unidadeId,
        nao_conformidade_id: nc.id,
        numero_determinacao: data.numeroDeterminacao,
        descricao: item.texto_determinacao,
        status: 'pendente'
      });
    }

    if (item.texto_recomendacao) {
      await this.create('Recomendacao', {
        unidade_fiscalizada_id: unidadeId,
        numero_recomendacao: data.numeroRecomendacao,
        descricao: item.texto_recomendacao,
        origem: 'checklist'
      });
    }

    return resposta;
  }

  // Autos de Infração
  async getAutosInfracao(fiscalizacaoId = null) {
    const filter = fiscalizacaoId ? { fiscalizacao_id: fiscalizacaoId } : {};
    return this.read('AutoInfracao', filter, '-created_date', 500);
  }

  /**
   * Atualiza chaves estrangeiras após mapeamento de IDs
   */
  async updateForeignKeys(entityName, foreignKeyField, oldId, newId) {
    const mapping = this.entityMappings[entityName];
    if (!mapping) return;

    try {
      const records = await db[mapping.local].where(foreignKeyField).equals(oldId).toArray();
      console.log(`[DataService] Atualizando ${records.length} registros de ${entityName} com ${foreignKeyField}: ${oldId} -> ${newId}`);
      
      for (const record of records) {
        await db[mapping.local].update(record.id, {
          [foreignKeyField]: newId
        });
      }
    } catch (error) {
      console.error(`[DataService] Erro ao atualizar foreign keys em ${entityName}:`, error);
    }
  }

  // ========== MÉTODOS DE SINCRONIZAÇÃO ==========

  /**
   * Baixa todos os dados de referência do servidor
   */
  async downloadAllReferenceData() {
    if (!this.isOnline) {
      throw new Error('Sem conexão com a internet');
    }

    const results = { success: [], failed: [], details: {} };

    // Lista de entidades de referência para baixar
    const referenceEntities = [
      'Municipio',
      'TipoUnidade',
      'PrestadorServico',
      'ItemChecklist'
    ];

    for (const entityName of referenceEntities) {
      try {
        console.log(`[downloadAllReferenceData] Baixando ${entityName}...`);
        const data = await base44.entities[entityName].list('-created_date', 1000);
        console.log(`[downloadAllReferenceData] ${entityName}: ${data.length} registros`);
        
        await this.cacheToLocal(entityName, data);
        results.success.push(entityName);
        results.details[entityName] = data.length;
      } catch (error) {
        console.error(`[downloadAllReferenceData] Erro ao baixar ${entityName}:`, error);
        results.failed.push({ entity: entityName, error: error.message });
      }
    }

    console.log('[downloadAllReferenceData] Resultado:', results);
    return results;
  }

  /**
   * Envia dados pendentes para o servidor
   */
  async uploadPendingData() {
    if (!this.isOnline) {
      throw new Error('Sem conexão com a internet');
    }

    const pending = await this.getPending();
    const results = { success: 0, failed: 0, idMappings: {} };

    for (const item of pending) {
      try {
        const data = JSON.parse(item.data);
        const mapping = this.entityMappings[item.entityName];

        if (item.operation === 'create') {
          const result = await base44.entities[item.entityName].create(data);
          
          // Mapeia ID temporário para ID real
          const tempId = data.id;
          const realId = result.id;
          results.idMappings[tempId] = realId;
          
          // Atualiza registro local com ID real
          await db[mapping.local].delete(tempId);
          await db[mapping.local].put({ ...result, _pending: false });
          
          console.log(`[DataService] ID mapping: ${tempId} -> ${realId}`);
          
          // Atualiza referências em entidades relacionadas
          if (item.entityName === 'Fiscalizacao') {
            await this.updateForeignKeys('UnidadeFiscalizada', 'fiscalizacao_id', tempId, realId);
          } else if (item.entityName === 'UnidadeFiscalizada') {
            await this.updateForeignKeys('RespostaChecklist', 'unidade_fiscalizada_id', tempId, realId);
            await this.updateForeignKeys('NaoConformidade', 'unidade_fiscalizada_id', tempId, realId);
            await this.updateForeignKeys('ConstatacaoManual', 'unidade_fiscalizada_id', tempId, realId);
            await this.updateForeignKeys('Determinacao', 'unidade_fiscalizada_id', tempId, realId);
            await this.updateForeignKeys('Recomendacao', 'unidade_fiscalizada_id', tempId, realId);
          }
        } else if (item.operation === 'update') {
          await base44.entities[item.entityName].update(data.id, data);
          await db[mapping.local].update(data.id, { _pending: false });
        } else if (item.operation === 'delete') {
          await base44.entities[item.entityName].delete(data.id);
        }

        // Remove da fila
        try {
          await db.syncQueue.delete(item.id);
        } catch (error) {
          console.warn('[DataService] Error deleting from sync queue:', error);
        }
        results.success++;
      } catch (error) {
        console.error(`Erro ao sincronizar ${item.entityName}:`, error);
        // Marca como falho
        try {
          await db.syncQueue.update(item.id, {
            status: 'failed',
            attempts: (item.attempts || 0) + 1
          });
        } catch (err) {
          console.warn('[DataService] Error updating sync queue:', err);
        }
        results.failed++;
      }
    }

    return results;
  }
}

const DataService = new DataServiceClass();
export default DataService;