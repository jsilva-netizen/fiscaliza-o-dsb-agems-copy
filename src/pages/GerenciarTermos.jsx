import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, Send, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GerenciarTermos() {
    const queryClient = useQueryClient();
    const [selectedFiscalizacao, setSelectedFiscalizacao] = useState(null);
    const [termoForm, setTermoForm] = useState({ observacoes: '' });

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list()
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes'],
        queryFn: () => base44.entities.Determinacao.list()
    });

    const { data: termos = [] } = useQuery({
        queryKey: ['termos-notificacao'],
        queryFn: () => base44.entities.TermoNotificacao.list()
    });

    const { data: prestadores = [] } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list()
    });

    const criarTermoMutation = useMutation({
        mutationFn: async (dados) => {
            const novoTermo = await base44.entities.TermoNotificacao.create(dados);
            return novoTermo;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Termo criado com sucesso!');
            setSelectedFiscalizacao(null);
        }
    });

    const enviarTermoMutation = useMutation({
        mutationFn: async ({ id, data_envio }) => {
            return base44.entities.TermoNotificacao.update(id, {
                status: 'enviado',
                data_envio
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['termos-notificacao'] });
            alert('Termo enviado com sucesso!');
        }
    });

    const handleCriarTermo = (fiscalizacao) => {
        if (!fiscalizacao.prestador_servico_id) {
            alert('Fiscalização sem prestador de serviço');
            return;
        }

        const determinacoesDA = determinacoes.filter(d => d.prestador_servico_id === fiscalizacao.prestador_servico_id);
        const numeroTermo = `TN-${new Date().getFullYear()}-${String(termos.length + 1).padStart(3, '0')}`;

        criarTermoMutation.mutate({
            fiscalizacao_id: fiscalizacao.id,
            prestador_servico_id: fiscalizacao.prestador_servico_id,
            numero_termo: numeroTermo,
            data_geracao: new Date().toISOString(),
            status: 'rascunho',
            observacoes: termoForm.observacoes
        });
    };

    const getPrestadorNome = (id) => {
        const p = prestadores.find(pres => pres.id === id);
        return p?.nome || 'N/A';
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            rascunho: { label: 'Rascunho', color: 'bg-gray-500' },
            enviado: { label: 'Enviado', color: 'bg-blue-600' },
            recebido: { label: 'Recebido', color: 'bg-green-600' },
            respondido: { label: 'Respondido', color: 'bg-purple-600' }
        };
        return statusMap[status] || statusMap.rascunho;
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
                    <h1 className="text-3xl font-bold">Gerenciar Termos de Notificação</h1>
                </div>

                {/* Tabs de Seções */}
                <div className="grid grid-cols-2 gap-6">
                    {/* Coluna 1: Fiscalizações com Determinações */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Fiscalizações com Determinações</h2>
                        <div className="space-y-3">
                            {fiscalizacoes.map(fisc => {
                                const temDeterminacoes = determinacoes.some(d => d.prestador_servico_id === fisc.prestador_servico_id);
                                const temTermo = termos.some(t => t.fiscalizacao_id === fisc.id);

                                if (!temDeterminacoes) return null;

                                return (
                                    <Card key={fisc.id}>
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold">{getPrestadorNome(fisc.prestador_servico_id)}</h3>
                                                    <p className="text-xs text-gray-500 mt-1">Serviço: {fisc.servico}</p>
                                                    <p className="text-xs text-gray-500">Data: {new Date(fisc.data_inicio).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                                <div className="text-right">
                                                    {temTermo ? (
                                                        <Badge className="bg-green-600">Termo criado</Badge>
                                                    ) : (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button size="sm" onClick={() => setSelectedFiscalizacao(fisc)}>
                                                                    <FileText className="h-4 w-4 mr-1" />
                                                                    Criar Termo
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent>
                                                                <DialogHeader>
                                                                    <DialogTitle>Criar Termo de Notificação</DialogTitle>
                                                                </DialogHeader>
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <Label>Prestador</Label>
                                                                        <p className="text-sm text-gray-600">{getPrestadorNome(fisc.prestador_servico_id)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <Label>Observações</Label>
                                                                        <Textarea
                                                                            placeholder="Adicione observações ao termo..."
                                                                            value={termoForm.observacoes}
                                                                            onChange={(e) => setTermoForm({ observacoes: e.target.value })}
                                                                            className="min-h-24"
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => handleCriarTermo(fisc)}
                                                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                                                    >
                                                                        Gerar Termo
                                                                    </Button>
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Coluna 2: Termos Criados */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Termos Criados</h2>
                        <div className="space-y-3">
                            {termos.map(termo => (
                                <Card key={termo.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{termo.numero_termo}</h3>
                                                <p className="text-xs text-gray-500 mt-1">Prestador: {getPrestadorNome(termo.prestador_servico_id)}</p>
                                                <p className="text-xs text-gray-500">Criado: {new Date(termo.data_geracao).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div className="text-right">
                                                <Badge className={getStatusBadge(termo.status).color}>
                                                    {getStatusBadge(termo.status).label}
                                                </Badge>
                                                {termo.status === 'rascunho' && (
                                                    <Button
                                                        size="sm"
                                                        className="mt-2 bg-blue-600 hover:bg-blue-700 w-full"
                                                        onClick={() => enviarTermoMutation.mutate({
                                                            id: termo.id,
                                                            data_envio: new Date().toISOString()
                                                        })}
                                                    >
                                                        <Send className="h-4 w-4 mr-1" />
                                                        Enviar
                                                    </Button>
                                                )}
                                                {termo.arquivo_url && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="mt-2 w-full"
                                                        onClick={() => window.open(termo.arquivo_url)}
                                                    >
                                                        <Download className="h-4 w-4 mr-1" />
                                                        Baixar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}