import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fiscalizacao_id } = await req.json();

        if (!fiscalizacao_id) {
            return Response.json({ error: 'fiscalizacao_id é obrigatório' }, { status: 400 });
        }

        // Buscar dados da fiscalização
        const fiscalizacao = await base44.entities.Fiscalizacao.filter({ id: fiscalizacao_id });
        if (!fiscalizacao || fiscalizacao.length === 0) {
            return Response.json({ error: 'Fiscalização não encontrada' }, { status: 404 });
        }

        const fisc = fiscalizacao[0];

        // Buscar unidades fiscalizadas
        const unidades = await base44.entities.UnidadeFiscalizada.filter({ 
            fiscalizacao_id: fiscalizacao_id 
        });

        // Buscar NCs, Determinações e Recomendações relacionadas
        const unidadeIds = unidades.map(u => u.id);
        
        let ncs = [];
        let determinacoes = [];
        let recomendacoes = [];

        if (unidadeIds.length > 0) {
            ncs = await base44.entities.NaoConformidade.filter({});
            ncs = ncs.filter(nc => unidadeIds.includes(nc.unidade_fiscalizada_id));
            
            determinacoes = await base44.entities.Determinacao.filter({});
            determinacoes = determinacoes.filter(d => unidadeIds.includes(d.unidade_fiscalizada_id));
            
            recomendacoes = await base44.entities.Recomendacao.filter({});
            recomendacoes = recomendacoes.filter(r => unidadeIds.includes(r.unidade_fiscalizada_id));
        }

        // Contar por status
        const ncsAbiertas = determinacoes.filter(d => d.status === 'pendente').length;
        const ncsCumpridas = determinacoes.filter(d => d.status === 'cumprida').length;
        const ncsNaoCumpridas = determinacoes.filter(d => d.status === 'nao_cumprida').length;

        // Preparar dados para o LLM
        const prompt = `Gere um resumo executivo conciso e profissional de uma fiscalização realizada:

FISCALIZAÇÃO:
- Serviço: ${fisc.servico}
- Município: ${fisc.municipio_nome}
- Prestador: ${fisc.prestador_servico_nome}
- Data: ${new Date(fisc.data_inicio).toLocaleDateString('pt-BR')}
- Status: ${fisc.status}

RESULTADOS:
- Unidades Vistoriadas: ${unidades.length}
- Não Conformidades Identificadas: ${ncs.length}
- Determinações Pendentes: ${ncsAbiertas}
- Determinações Cumpridas: ${ncsCumpridas}
- Determinações Não Cumpridas: ${ncsNaoCumpridas}
- Recomendações: ${recomendacoes.length}

PRINCIPAIS NÃO CONFORMIDADES:
${ncs.slice(0, 5).map((nc, i) => `${i + 1}. ${nc.descricao}`).join('\n')}

RECOMENDAÇÕES PRINCIPAIS:
${recomendacoes.slice(0, 3).map((rec, i) => `${i + 1}. ${rec.descricao}`).join('\n')}

Crie um resumo com no máximo 4-5 frases que:
1. Identifique o contexto da fiscalização
2. Destaque os principais achados
3. Mencione o status de conformidade geral
4. Sugira o próximo passo recomendado

Seja objetivo e profissional.`;

        const resumo = await base44.integrations.Core.InvokeLLM({
            prompt: prompt
        });

        return Response.json({ 
            resumo: resumo,
            fiscalizacao_id: fiscalizacao_id,
            data_geracao: new Date().toISOString()
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});