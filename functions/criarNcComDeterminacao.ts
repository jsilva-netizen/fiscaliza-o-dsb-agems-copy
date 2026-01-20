import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            unidade_fiscalizada_id,
            resposta_checklist_id,
            numero_constatacao,
            artigo_portaria,
            descricao_nc,
            descricao_determinacao,
            prazo_dias = 30
        } = await req.json();

        // Buscar contagens ATUAIS do banco (não do frontend)
        const ncsAtuais = await base44.entities.NaoConformidade.filter({ 
            unidade_fiscalizada_id 
        });
        const determinacoesAtuais = await base44.entities.Determinacao.filter({ 
            unidade_fiscalizada_id 
        });

        // Gerar números sequenciais baseado na contagem atual
        const numeroNC = `NC${ncsAtuais.length + 1}`;
        const numeroD = `D${determinacoesAtuais.length + 1}`;

        // Calcular data_limite: hoje + prazo_dias
        const hoje = new Date();
        const data_limite = new Date(hoje);
        data_limite.setDate(data_limite.getDate() + prazo_dias);
        const data_limite_str = data_limite.toISOString().split('T')[0];

        // Criar NC atomicamente
        const nc = await base44.entities.NaoConformidade.create({
            unidade_fiscalizada_id,
            resposta_checklist_id,
            numero_nc: numeroNC,
            artigo_portaria,
            descricao: descricao_nc
        });

        // Criar Determinação atomicamente
        const det = await base44.entities.Determinacao.create({
            unidade_fiscalizada_id,
            nao_conformidade_id: nc.id,
            numero_determinacao: numeroD,
            descricao: descricao_determinacao,
            prazo_dias,
            data_limite: data_limite_str,
            status: 'pendente'
        });

        return Response.json({ 
            success: true,
            nc: {
                id: nc.id,
                numero_nc: numeroNC
            },
            determinacao: {
                id: det.id,
                numero_determinacao: numeroD,
                data_limite: data_limite_str
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});