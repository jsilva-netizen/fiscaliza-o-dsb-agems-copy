import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CamaraJulgamento() {
    const queryClient = useQueryClient();
    const [julgamentoForm, setJulgamentoForm] = useState({
        decisao: 'multa_aplicada',
        valor_multa: '',
        justificativa: ''
    });

    const { data: pareres = [] } = useQuery({
        queryKey: ['pareres-tecnicos'],
        queryFn: () => base44.entities.ParerTecnico.list()
    });

    const { data: autos = [] } = useQuery({
        queryKey: ['autos-infracao'],
        queryFn: () => base44.entities.AutoInfracao.list()
    });

    const { data: julgamentos = [] } = useQuery({
        queryKey: ['julgamentos'],
        queryFn: () => base44.entities.Julgamento.list()
    });

    const { data: prestadores = [] } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list()
    });

    const salvarJulgamentoMutation = useMutation({
        mutationFn: async (dados) => {
            const parecer = pareres.find(p => p.id === dados.parecer_id);
            return base44.entities.Julgamento.create({
                parecer_tecnico_id: dados.parecer_id,
                auto_id: dados.auto_id,
                prestador_servico_id: dados.prestador_id,
                data_julgamento: new Date().toISOString(),
                decisao: dados.decisao,
                valor_multa_final: dados.valor_multa ? parseFloat(dados.valor_multa) : null,
                justificativa_decisao: dados.justificativa,
                status: 'julgado'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['julgamentos'] });
            alert('Julgamento registrado!');
            setJulgamentoForm({ decisao: 'multa_aplicada', valor_multa: '', justificativa: '' });
        }
    });

    const parecesParaJulgar = pareres.filter(p => 
        p.status === 'finalizado' && 
        !julgamentos.some(j => j.parecer_id === p.id)
    );

    const getPrestadorNome = (id) => {
        const p = prestadores.find(pres => pres.id === id);
        return p?.nome || 'N/A';
    };

    const getRecomendacaoLabel = (rec) => {
        const labels = {
            aplicar_multa: 'Aplicar Multa',
            rejeitar_multa: 'Rejeitar Multa',
            analise_adicional: 'Análise Adicional'
        };
        return labels[rec] || rec;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <Link to={createPageUrl('Home')}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">Câmara de Julgamento</h1>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Para Julgar</p>
                            <p className="text-2xl font-bold text-orange-600">{parecesParaJulgar.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Multas Aplicadas</p>
                            <p className="text-2xl font-bold text-red-600">{julgamentos.filter(j => j.decisao === 'multa_aplicada').length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-sm text-gray-600 mb-1">Multas Rejeitadas</p>
                            <p className="text-2xl font-bold text-green-600">{julgamentos.filter(j => j.decisao === 'multa_rejeitada').length}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Casos para Julgar */}
                <h2 className="text-2xl font-semibold mb-4">Pareceres Aguardando Julgamento</h2>
                <div className="space-y-4">
                    {parecesParaJulgar.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                Nenhum parecer aguardando julgamento
                            </CardContent>
                        </Card>
                    ) : (
                        parecesParaJulgar.map(parecer => {
                            const auto = autos.find(a => a.id === parecer.auto_id);
                            return (
                                <Card key={parecer.id} className="border-orange-300 bg-orange-50">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold mb-2">{auto?.numero_auto}</h3>
                                                <div className="grid grid-cols-3 gap-4 mb-2">
                                                    <div>
                                                        <p className="text-xs text-gray-600">Prestador</p>
                                                        <p className="text-sm font-medium">{getPrestadorNome(auto?.prestador_servico_id)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-600">Recomendação do Técnico</p>
                                                        <Badge className={parecer.recomendacao === 'aplicar_multa' ? 'bg-red-600' : 'bg-green-600'}>
                                                            {getRecomendacaoLabel(parecer.recomendacao)}
                                                        </Badge>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-600">Valor Sugerido</p>
                                                        <p className="text-sm font-medium">
                                                            {parecer.valor_multa_sugerido ? `R$ ${parecer.valor_multa_sugerido.toFixed(2)}` : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded p-2 mb-3">
                                                    <p className="text-xs text-gray-600 font-medium mb-1">Análise Técnica:</p>
                                                    <p className="text-xs text-gray-700 line-clamp-3">{parecer.analise_tecnica}</p>
                                                </div>
                                            </div>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button className="bg-purple-600 hover:bg-purple-700">
                                                        Julgar
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Julgamento - {auto?.numero_auto}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <Label>Decisão</Label>
                                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                                <Button
                                                                    variant={julgamentoForm.decisao === 'multa_aplicada' ? 'default' : 'outline'}
                                                                    onClick={() => setJulgamentoForm({ ...julgamentoForm, decisao: 'multa_aplicada' })}
                                                                    className={julgamentoForm.decisao === 'multa_aplicada' ? 'bg-red-600 hover:bg-red-700' : ''}
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                                    Aplicar Multa
                                                                </Button>
                                                                <Button
                                                                    variant={julgamentoForm.decisao === 'multa_rejeitada' ? 'default' : 'outline'}
                                                                    onClick={() => setJulgamentoForm({ ...julgamentoForm, decisao: 'multa_rejeitada' })}
                                                                    className={julgamentoForm.decisao === 'multa_rejeitada' ? 'bg-green-600 hover:bg-green-700' : ''}
                                                                >
                                                                    <XCircle className="h-4 w-4 mr-1" />
                                                                    Rejeitar Multa
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {julgamentoForm.decisao === 'multa_aplicada' && (
                                                            <div>
                                                                <Label>Valor da Multa (R$)</Label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="0,00"
                                                                    value={julgamentoForm.valor_multa}
                                                                    onChange={(e) => setJulgamentoForm({ ...julgamentoForm, valor_multa: e.target.value })}
                                                                />
                                                            </div>
                                                        )}

                                                        <div>
                                                            <Label>Justificativa</Label>
                                                            <Textarea
                                                                placeholder="Justifique a decisão..."
                                                                value={julgamentoForm.justificativa}
                                                                onChange={(e) => setJulgamentoForm({ ...julgamentoForm, justificativa: e.target.value })}
                                                                className="min-h-24"
                                                            />
                                                        </div>

                                                        <Button
                                                            onClick={() => salvarJulgamentoMutation.mutate({
                                                                parecer_id: parecer.id,
                                                                auto_id: auto.id,
                                                                prestador_id: auto.prestador_servico_id,
                                                                ...julgamentoForm
                                                            })}
                                                            className="w-full bg-purple-600 hover:bg-purple-700"
                                                        >
                                                            Registrar Julgamento
                                                        </Button>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Julgamentos Realizados */}
                {julgamentos.length > 0 && (
                    <>
                        <h2 className="text-2xl font-semibold mb-4 mt-8">Julgamentos Realizados</h2>
                        <div className="space-y-2">
                            {julgamentos.slice(0, 10).map(julgamento => (
                                <Card key={julgamento.id}>
                                    <CardContent className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-sm">{julgamento.id}</p>
                                                <p className="text-xs text-gray-500">{new Date(julgamento.data_julgamento).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div>
                                                <Badge className={julgamento.decisao === 'multa_aplicada' ? 'bg-red-600' : 'bg-green-600'}>
                                                    {julgamento.decisao === 'multa_aplicada' ? 'Multa Aplicada' : 'Multa Rejeitada'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}