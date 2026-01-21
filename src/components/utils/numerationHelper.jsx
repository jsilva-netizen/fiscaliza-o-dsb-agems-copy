/**
 * Calcula a próxima numeração contínua entre unidades da mesma fiscalização
 * Verifica apenas registros de unidades ANTERIORES na mesma fiscalização
 */
export async function calcularProximaNumeracao(fiscalizacaoId, unidadeAtualId, base44) {
    // Buscar todas as unidades dessa fiscalização, ordenadas por criação
    const todasUnidades = await base44.entities.UnidadeFiscalizada.filter(
        { fiscalizacao_id: fiscalizacaoId },
        'created_date',
        500
    );

    // Encontrar posição da unidade atual
    const unidadeAtualIndex = todasUnidades.findIndex(u => u.id === unidadeAtualId);
    const unidadesAnteriores = todasUnidades.slice(0, unidadeAtualIndex);

    let contadores = { C: 0, NC: 0, D: 0, R: 0 };

    // Contar registros apenas de unidades anteriores
    if (unidadesAnteriores.length > 0) {
        const idsUnidadesAnteriores = unidadesAnteriores.map(u => u.id);

        const [respostas, ncs, determinacoes, recomendacoes] = await Promise.all([
            Promise.all(idsUnidadesAnteriores.map(id => 
                base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
            )).then(results => results.flat()),
            Promise.all(idsUnidadesAnteriores.map(id => 
                base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
            )).then(results => results.flat()),
            Promise.all(idsUnidadesAnteriores.map(id => 
                base44.entities.Determinacao.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
            )).then(results => results.flat()),
            Promise.all(idsUnidadesAnteriores.map(id => 
                base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: id }, 'created_date', 500)
            )).then(results => results.flat())
        ]);

        // Contar apenas respostas que são constatações (SIM ou NAO)
        contadores.C = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NAO').length;
        contadores.NC = ncs.length;
        contadores.D = determinacoes.length;
        contadores.R = recomendacoes.length;
    }

    return contadores;
}

/**
 * Gera números sequenciais para a unidade atual
 */
export function gerarNumeroConstatacao(contadores) {
    return `C${contadores.C + 1}`;
}

export function gerarNumeroNC(contadores) {
    return `NC${contadores.NC + 1}`;
}

export function gerarNumeroDeterminacao(contadores) {
    return `D${contadores.D + 1}`;
}

export function gerarNumeroRecomendacao(contadores) {
    return `R${contadores.R + 1}`;
}