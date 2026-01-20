// Camada de validação ANTES de executar qualquer operação
// Garante que o estado é válido em cada etapa

export const validarEstadoVistoria = async (params) => {
    const {
        base44,
        unidadeId,
        itensChecklist
    } = params;

    // 1. Validar integridade referencial
    const respostas = await base44.entities.RespostaChecklist.filter(
        { unidade_fiscalizada_id: unidadeId },
        '-created_date',
        500
    );

    const ncs = await base44.entities.NaoConformidade.filter(
        { unidade_fiscalizada_id: unidadeId },
        '-created_date',
        500
    );

    const determinacoes = await base44.entities.Determinacao.filter(
        { unidade_fiscalizada_id: unidadeId },
        '-created_date',
        500
    );

    const erros = [];

    // 2. Validar NCs órfãs (sem resposta relacionada)
    for (const nc of ncs) {
        const respostaPai = respostas.find(r => r.id === nc.resposta_checklist_id);
        if (!respostaPai) {
            erros.push(`NC ${nc.numero_nc} não tem resposta relacionada`);
        }
        // Validar se NC referencia constatação no texto
        if (!nc.descricao.includes('Constatação C')) {
            erros.push(`NC ${nc.numero_nc} falta referência à Constatação`);
        }
    }

    // 3. Validar Determinações órfãs (sem NC relacionada)
    for (const det of determinacoes) {
        const ncPai = ncs.find(n => n.id === det.nao_conformidade_id);
        if (!ncPai) {
            erros.push(`Determinação ${det.numero_determinacao} não tem NC relacionada`);
        }
    }

    // 4. Validar sequência de números (sem gaps)
    const validarSequencia = (items, campo, tipo) => {
        const numeros = items
            .map(i => parseInt(i[campo]?.replace(tipo, '') || '0'))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        for (let i = 0; i < numeros.length; i++) {
            if (numeros[i] !== i + 1) {
                erros.push(`${tipo}: numeração com gap em ${tipo}${i + 1}`);
            }
        }
    };

    validarSequencia(respostas.filter(r => r.numero_constatacao), 'numero_constatacao', 'C');
    validarSequencia(ncs, 'numero_nc', 'NC');
    validarSequencia(determinacoes, 'numero_determinacao', 'D');

    // 5. Validar respostas obrigatórias
    const itensObrigos = itensChecklist || [];
    const respostasCompletas = respostas.map(r => r.item_checklist_id);
    const itensNaoRespondidos = itensObrigos.filter(i => !respostasCompletas.includes(i.id));

    if (itensNaoRespondidos.length > 0) {
        erros.push(`${itensNaoRespondidos.length} item(ns) do checklist não respondidos`);
    }

    return {
        valido: erros.length === 0,
        erros,
        stats: {
            constatacoes: respostas.filter(r => r.numero_constatacao).length,
            ncs: ncs.length,
            determinacoes: determinacoes.length,
            respostasTotal: respostas.length,
            itensTotal: itensObrigos.length
        }
    };
};

export const corrigirInconsistencias = async (params) => {
    const { base44, unidadeId } = params;

    // Corrigir NCs sem referência à constatação
    const respostas = await base44.entities.RespostaChecklist.filter(
        { unidade_fiscalizada_id: unidadeId }
    );
    const ncs = await base44.entities.NaoConformidade.filter(
        { unidade_fiscalizada_id: unidadeId }
    );

    for (const nc of ncs) {
        const resposta = respostas.find(r => r.id === nc.resposta_checklist_id);
        if (resposta?.numero_constatacao && !nc.descricao.includes('Constatação')) {
            await base44.entities.NaoConformidade.update(nc.id, {
                descricao: `A Constatação ${resposta.numero_constatacao} não cumpre o disposto no ${nc.artigo_portaria || 'regulamento'}. ${nc.descricao}`
            });
        }
    }

    // Deletar Determinações órfãs (sem NC)
    const determinacoes = await base44.entities.Determinacao.filter(
        { unidade_fiscalizada_id: unidadeId }
    );

    for (const det of determinacoes) {
        const ncRelacionada = ncs.find(n => n.id === det.nao_conformidade_id);
        if (!ncRelacionada) {
            await base44.entities.Determinacao.delete(det.id);
        }
    }

    // Deletar NCs órfãs (sem resposta)
    for (const nc of ncs) {
        const respostaRelacionada = respostas.find(r => r.id === nc.resposta_checklist_id);
        if (!respostaRelacionada) {
            await base44.entities.NaoConformidade.delete(nc.id);
        }
    }
};