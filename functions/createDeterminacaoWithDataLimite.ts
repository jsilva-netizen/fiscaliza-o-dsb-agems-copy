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
            nao_conformidade_id,
            numero_determinacao,
            descricao,
            prazo_dias = 30
        } = await req.json();

        // Calcular data_limite: hoje + prazo_dias
        const hoje = new Date();
        const data_limite = new Date(hoje);
        data_limite.setDate(data_limite.getDate() + prazo_dias);

        // Formatar como YYYY-MM-DD
        const data_limite_str = data_limite.toISOString().split('T')[0];

        // Criar Determinacao com data_limite calculada
        const determinacao = await base44.entities.Determinacao.create({
            unidade_fiscalizada_id,
            nao_conformidade_id,
            numero_determinacao,
            descricao,
            prazo_dias,
            data_limite: data_limite_str,
            status: 'pendente'
        });

        return Response.json({ 
            success: true,
            determinacao
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});