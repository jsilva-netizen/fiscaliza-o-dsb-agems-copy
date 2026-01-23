import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Buscar todos os autos para contar sequência por ano
        const autos = await base44.asServiceRole.entities.AutoInfracao.list();
        
        const ano = new Date().getFullYear();
        const autosAnoAtual = autos.filter(a => a.numero_auto && a.numero_auto.includes(`/${ano}/`));
        
        const proximoNumero = autosAnoAtual.length + 1;
        const numeroFormatado = String(proximoNumero).padStart(3, '0');
        
        // Retornar número no formato: AI nº 001/2026/DSB/AGEMS
        const numeroAuto = `AI nº ${numeroFormatado}/${ano}/DSB/AGEMS`;

        return Response.json({ numero_auto: numeroAuto });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});