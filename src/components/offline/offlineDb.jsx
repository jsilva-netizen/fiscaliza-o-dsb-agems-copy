import Dexie from 'dexie';

// Cria uma instância Dexie para o banco offline
const db = new Dexie('agems_fiscalizacao');

// Define o schema do banco
db.version(1).stores({
  // Dados de referência
  municipios: 'id, nome, codigo_ibge',
  tipos_unidade: 'id, nome, tipo_unidade_codigo',
  prestadores_servico: 'id, nome, cnpj',
  item_checklist: 'id, tipo_unidade_id, ordem',
  
  // Dados de fiscalização
  fiscalizacoes: 'id, municipio_id, status, data_inicio',
  unidades_fiscalizadas: 'id, fiscalizacao_id, tipo_unidade_id, status',
  
  // Respostas e constatações
  respostas_checklist: 'id, unidade_fiscalizada_id, item_checklist_id',
  nao_conformidades: 'id, unidade_fiscalizada_id, resposta_checklist_id',
  constatacoes_manuais: 'id, unidade_fiscalizada_id, ordem',
  determinacoes: 'id, unidade_fiscalizada_id, nao_conformidade_id',
  recomendacoes: 'id, unidade_fiscalizada_id',
  autos_infracao: 'id, fiscalizacao_id, determinacao_id',
  
  // Fila de sincronização
  syncQueue: '++id, entityName, operation, status, timestamp'
});

export default db;