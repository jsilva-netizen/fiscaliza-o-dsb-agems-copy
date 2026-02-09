import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { constatacao_manual_id, unidade_fiscalizada_id } = await req.json();

        if (!constatacao_manual_id || !unidade_fiscalizada_id) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Buscar a constatação manual
        const constatacao = await base44.asServiceRole.entities.ConstatacaoManual.filter({
            id: constatacao_manual_id
        }).then(r => r[0]);

        if (!constatacao) {
            return Response.json({ error: 'Constatação não encontrada' }, { status: 404 });
        }

        // 2. Se gera NC, buscar e deletar NCs associadas (baseado no número da constatação)
        if (constatacao.gera_nc) {
            const ncs = await base44.asServiceRole.entities.NaoConformidade.filter({
                unidade_fiscalizada_id: unidade_fiscalizada_id
            });

            // Encontrar NC que referencia esta constatação no texto
            for (const nc of ncs) {
                if (nc.descricao && nc.descricao.includes(constatacao.numero_constatacao)) {
                    // Deletar determinações associadas a esta NC
                    const determinacoes = await base44.asServiceRole.entities.Determinacao.filter({
                        nao_conformidade_id: nc.id
                    });

                    for (const det of determinacoes) {
                        await base44.asServiceRole.entities.Determinacao.delete(det.id);
                    }

                    // Deletar a NC
                    await base44.asServiceRole.entities.NaoConformidade.delete(nc.id);
                }
            }
        }

        // 3. Deletar a constatação manual
        await base44.asServiceRole.entities.ConstatacaoManual.delete(constatacao_manual_id);

        // 4. Renumerar todas as constatações e itens relacionados
        const fiscalizacao = await base44.asServiceRole.entities.UnidadeFiscalizada.filter({
            id: unidade_fiscalizada_id
        }).then(r => r[0]);

        if (!fiscalizacao) {
            return Response.json({ error: 'Unidade não encontrada' }, { status: 404 });
        }

        // Buscar todas as respostas do checklist
        const todasRespostas = await base44.asServiceRole.entities.RespostaChecklist.filter({
            unidade_fiscalizada_id: unidade_fiscalizada_id
        }, 'created_date', 200);

        // Buscar todos os itens do checklist
        const unidadeFiscalizada = await base44.asServiceRole.entities.UnidadeFiscalizada.filter({
            id: unidade_fiscalizada_id
        }).then(r => r[0]);

        const todosItens = await base44.asServiceRole.entities.ItemChecklist.filter({
            tipo_unidade_id: unidadeFiscalizada.tipo_unidade_id
        }, 'ordem', 100);

        // Buscar constatações manuais restantes
        const constatacoesManuaisRestantes = await base44.asServiceRole.entities.ConstatacaoManual.filter({
            unidade_fiscalizada_id: unidade_fiscalizada_id
        }, 'ordem', 100);

        // 5. Renumerar tudo
        let contadorC = 1;
        let contadorNC = 1;
        let contadorD = 1;
        let contadorR = 1;

        // Primeiro, renumerar respostas do checklist
        for (const resp of todasRespostas) {
            const itemResp = todosItens.find(it => it.id === resp.item_checklist_id);
            
            let temTextoConstatacao = false;
            if (resp.resposta === 'SIM' && itemResp?.texto_constatacao_sim?.trim()) {
                temTextoConstatacao = true;
            } else if (resp.resposta === 'NAO' && itemResp?.texto_constatacao_nao?.trim()) {
                temTextoConstatacao = true;
            }
            
            if ((resp.resposta === 'SIM' || resp.resposta === 'NAO') && temTextoConstatacao) {
                const numeroConstatacao = `C${contadorC}`;
                
                await base44.asServiceRole.entities.RespostaChecklist.update(resp.id, {
                    numero_constatacao: numeroConstatacao
                });

                contadorC++;

                if (itemResp?.gera_nc && resp.resposta === 'NAO') {
                    const numeroNC = `NC${contadorNC}`;
                    const numeroDet = `D${contadorD}`;
                    const numeroRec = `R${contadorR}`;

                    // Buscar NC existente
                    const ncsExistentes = await base44.asServiceRole.entities.NaoConformidade.filter({
                        unidade_fiscalizada_id: unidade_fiscalizada_id,
                        resposta_checklist_id: resp.id
                    });

                    if (ncsExistentes.length > 0) {
                        const nc = ncsExistentes[0];
                        
                        // Atualizar número da NC
                        let ncDescricao = itemResp.texto_nc;
                        if (!ncDescricao || !ncDescricao.trim()) {
                            ncDescricao = `A constatação ${numeroConstatacao} não cumpre o disposto no ${itemResp.artigo_portaria || 'artigo não especificado'}.`;
                        }

                        await base44.asServiceRole.entities.NaoConformidade.update(nc.id, {
                            numero_nc: numeroNC,
                            descricao: ncDescricao
                        });

                        // Atualizar Determinação
                        const determinacoes = await base44.asServiceRole.entities.Determinacao.filter({
                            nao_conformidade_id: nc.id
                        });

                        if (determinacoes.length > 0) {
                            const det = determinacoes[0];
                            const textoDet = itemResp.texto_determinacao || 'regularizar a situação identificada';
                            const textoFinalDet = `Para sanar a ${numeroNC} ${textoDet}. Prazo: 30 dias.`;
                            
                            await base44.asServiceRole.entities.Determinacao.update(det.id, {
                                numero_determinacao: numeroDet,
                                descricao: textoFinalDet
                            });
                            contadorD++;
                        }

                        // Atualizar Recomendação se existir
                        const recomendacoes = await base44.asServiceRole.entities.Recomendacao.filter({
                            unidade_fiscalizada_id: unidade_fiscalizada_id,
                            origem: 'checklist'
                        });

                        // Buscar recomendação associada a este item (pela ordem de criação)
                        if (itemResp.texto_recomendacao) {
                            const recIndex = todasRespostas.filter(r => {
                                const item = todosItens.find(i => i.id === r.item_checklist_id);
                                return item?.gera_nc && r.resposta === 'NAO' && item?.texto_recomendacao;
                            }).findIndex(r => r.id === resp.id);

                            if (recIndex !== -1 && recomendacoes[recIndex]) {
                                await base44.asServiceRole.entities.Recomendacao.update(recomendacoes[recIndex].id, {
                                    numero_recomendacao: numeroRec
                                });
                            }
                            contadorR++;
                        }

                        contadorNC++;
                    }
                }
            }
        }

        // Depois, renumerar constatações manuais
        for (const constManual of constatacoesManuaisRestantes) {
            const numeroConstatacao = `C${contadorC}`;
            await base44.asServiceRole.entities.ConstatacaoManual.update(constManual.id, {
                numero_constatacao: numeroConstatacao
            });
            contadorC++;
        }

        // Renumerar recomendações manuais
        const recsManuais = await base44.asServiceRole.entities.Recomendacao.filter({
            unidade_fiscalizada_id: unidade_fiscalizada_id,
            origem: 'manual'
        }, 'created_date', 100);
        
        for (const recManual of recsManuais) {
            await base44.asServiceRole.entities.Recomendacao.update(recManual.id, {
                numero_recomendacao: `R${contadorR}`
            });
            contadorR++;
        }

        return Response.json({ 
            success: true,
            message: 'Constatação deletada e itens renumerados com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar constatação:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});