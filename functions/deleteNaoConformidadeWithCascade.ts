import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { ncId } = await req.json();

        if (!ncId) {
            return Response.json({ error: 'Missing ncId' }, { status: 400 });
        }

        // Buscar a NC
        const nc = await base44.entities.NaoConformidade.filter({ id: ncId }).then(r => r[0]);
        if (!nc) {
            return Response.json({ error: 'NC not found' }, { status: 404 });
        }

        // Buscar todas determinações relacionadas
        const determinacoes = await base44.entities.Determinacao.filter({ 
            nao_conformidade_id: ncId 
        });

        // Deletar todas as determinações da NC
        for (const det of determinacoes) {
            await base44.entities.Determinacao.delete(det.id);
        }

        // Deletar a NC
        await base44.entities.NaoConformidade.delete(ncId);

        return Response.json({ 
            success: true,
            deletedDeterminacoes: determinacoes.length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});