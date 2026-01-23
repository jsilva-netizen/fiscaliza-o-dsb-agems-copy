import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Lock, Eye, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AnalisarResposta() {
    const [searchParams] = useSearchParams();
    const termoId = searchParams.get('termo');
    const queryClient = useQueryClient();
    const [detalheDeterminacao, setDetalheDeterminacao] = useState(null);
    const [analiseForm, setAnaliseForm] = useState({
        status: '',
        manifestacao_prestador: '',
        descricao_atendimento: '',
        dentro_prazo: true
    });
    const [confirmDialog, setConfirmDialog] = useState({ open: false, determinacao: null });

    const { data: termo } = useQuery({
        queryKey: ['termo', termoId],
        queryFn: () => base44.entities.TermoNotificacao.list().then(ts => ts.find(t => t.id === termoId)),
        enabled: !!termoId
    });

    const { data: fiscalizacao } = useQuery({
        queryKey: ['fiscalizacao', termo?.fiscalizacao_id],
        queryFn: () => base44.entities.Fiscalizacao.list().then(fs => fs.find(f => f.id === termo.fiscalizacao_id)),
        enabled: !!termo
    });

    const { data: unidadesFiscalizadas = [] } = useQuery({
        queryKey: ['unidades-fiscalizadas', fiscalizacao?.id],
        queryFn: () => base44.entities.UnidadeFiscalizada.list().then(us => 
            us.filter(u => u.fiscalizacao_id === fiscalizacao.id)
        ),
        enabled: !!fiscalizacao
    });

    const { data: determinacoes = [] } = useQuery({
        queryKey: ['determinacoes', unidadesFiscalizadas],
        queryFn: async () => {
            const unidadeIds = unidadesFiscalizadas.map(u => u.id);
            const todasDets = await base44.entities.Determinacao.list();
            return todasDets.filter(d => unidadeIds.includes(d.unidade_fiscalizada_id)).sort((a, b) => {
                const numA = parseInt(a.numero_determinacao?.replace(/\D/g, '') || '0');
                const numB = parseInt(b.numero_determinacao?.replace(/\D/g, '') || '0');
                return numA - numB;
            });
        },
        enabled: unidadesFiscalizadas.length > 0
    });

    const { data: respostas = [] } = useQuery({
        queryKey: ['respostas-determinacao'],
        queryFn: () => base44.entities.RespostaDeterminacao.list()
    });

    const { data: municipios = [] } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list()
    });

    const { data: prestadores = [] } = useQuery({
        queryKey: ['prestadores'],
        queryFn: () => base44.entities.PrestadorServico.list()
    });

    const salvarAnaliseMutation = useMutation({
        mutationFn: async ({ determinacaoId, status, manifestacao, descricao }) => {
            const resposta = respostas.find(r => r.determinacao_id === determinacaoId);
            const user = await base44.auth.me();
            
            if (resposta) {
                return base44.entities.RespostaDeterminacao.update(resposta.id, {
                    status,
                    manifestacao_prestador: manifestacao,
                    descricao_atendimento: descricao,
                    data_resposta: new Date().toISOString()
                });
            } else {
                return base44.entities.RespostaDeterminacao.create({
                    determinacao_id: determinacaoId,
                    unidade_fiscalizada_id: determinacoes.find(d => d.id === determinacaoId)?.unidade_fiscalizada_id,
                    fiscalizacao_id: fiscalizacao.id,
                    prestador_servico_id: fiscalizacao.prestador_servico_id,
                    status,
                    tipo_resposta: status === 'atendida' ? 'atendida' : 'nao_respondida',
                    manifestacao_prestador: manifestacao,
                    descricao_atendimento: descricao,
                    data_resposta: new Date().toISOString(),
                    dentro_prazo: true
                });
            }
        },
        onSuccess: async (data, variables) => {
            await queryClient.invalidateQueries({ queryKey: ['respostas-determinacao'] });
            
            // Se não atendida, gerar auto de infração
            if (variables.status === 'nao_atendida') {
                const determinacao = determinacoes.find(d => d.id === variables.determinacaoId);
                const autosExistentes = await base44.entities.AutoInfracao.list();
                const ano = new Date().getFullYear();
                const numeroAuto = `AI-${ano}-${String(autosExistentes.length + 1).padStart(3, '0')}`;
                
                await base44.entities.AutoInfracao.create({
                    determinacao_id: variables.determinacaoId,
                    resposta_determinacao_id: data.id,
                    fiscalizacao_id: fiscalizacao.id,
                    prestador_servico_id: fiscalizacao.prestador_servico_id,
                    numero_auto: numeroAuto,
                    data_geracao: new Date().toISOString(),
                    status: 'gerado',
                    prazo_manifestacao: 15,
                    motivo_infracao: `Determinação ${determinacao.numero_determinacao} não atendida: ${determinacao.descricao}`
                });
            }
            
            alert('Análise salva com sucesso!');
            setDetalheDeterminacao(null);
            setAnaliseForm({ status: '', manifestacao_prestador: '', descricao_atendimento: '', dentro_prazo: true });
        }
    });

    const getMunicipioNome = (id) => municipios.find(m => m.id === id)?.nome || 'N/A';
    const getPrestadorNome = (id) => prestadores.find(p => p.id === id)?.nome || 'N/A';

    const getStatusResposta = (detId) => {
        const resp = respostas.find(r => r.determinacao_id === detId);
        return resp?.status || 'pendente';
    };

    const podeAnalisar = (index) => {
        if (index === 0) return true;
        const determinacaoAnterior = determinacoes[index - 1];
        const statusAnterior = getStatusResposta(determinacaoAnterior.id);
        return statusAnterior === 'atendida' || statusAnterior === 'nao_atendida';
    };

    const handleAbrirAnalise = (det, index) => {
        if (!podeAnalisar(index)) {
            alert('Você deve analisar as determinações na ordem sequencial. Analise a determinação anterior primeiro.');
            return;
        }
        setDetalheDeterminacao(det);
        const resp = respostas.find(r => r.determinacao_id === det.id);
        if (resp) {
            setAnaliseForm({
                status: resp.status,
                manifestacao_prestador: resp.manifestacao_prestador || '',
                descricao_atendimento: resp.descricao_atendimento || '',
                dentro_prazo: resp.dentro_prazo
            });
        }
    };

    const handleSalvarAnalise = () => {
        if (!analiseForm.status || !analiseForm.manifestacao_prestador || !analiseForm.descricao_atendimento) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }
        setConfirmDialog({ open: true, determinacao: detalheDeterminacao });
    };

    const confirmarAnalise = () => {
        salvarAnaliseMutation.mutate({
            determinacaoId: detalheDeterminacao.id,
            status: analiseForm.status,
            manifestacao: analiseForm.manifestacao_prestador,
            descricao: analiseForm.descricao_atendimento
        });
        setConfirmDialog({ open: false, determinacao: null });
    };

    if (!termoId || !termo) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-gray-600 mb-4">Carregando...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <Link to={createPageUrl('AnaliseManifestacao')}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Análise da Manifestação</h1>
                </div>

                {/* Info do TN */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{termo.numero_termo_notificacao || termo.numero_termo}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium">Município:</span> {getMunicipioNome(termo.municipio_id)}
                            </div>
                            <div>
                                <span className="font-medium">Prestador:</span> {getPrestadorNome(termo.prestador_servico_id)}
                            </div>
                            <div>
                                <span className="font-medium">Processo:</span> {termo.numero_processo || 'N/A'}
                            </div>
                            <div>
                                <span className="font-medium">Câmara:</span> {termo.camara_tecnica}
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium">Serviços:</span> {fiscalizacao?.servicos?.join(', ') || 'N/A'}
                            </div>
                        </div>
                        {termo.arquivos_resposta?.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                                <p className="font-medium mb-2">Arquivo de Resposta do Prestador:</p>
                                {termo.arquivos_resposta.map((arquivo, idx) => (
                                    <Button
                                        key={idx}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(arquivo.url, '_blank')}
                                        className="mr-2"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Visualizar PDF
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Lista de Determinações */}
                <div className="space-y-4">
                    {determinacoes.map((det, index) => {
                        const status = getStatusResposta(det.id);
                        const bloqueado = !podeAnalisar(index);
                        const statusIcon = status === 'atendida' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                          status === 'nao_atendida' ? <XCircle className="h-5 w-5 text-red-600" /> :
                                          status === 'aguardando_analise' ? <AlertCircle className="h-5 w-5 text-yellow-600" /> :
                                          <AlertCircle className="h-5 w-5 text-gray-400" />;

                        return (
                            <Card key={det.id} className={bloqueado ? 'opacity-50' : 'hover:shadow-lg transition-shadow'}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {statusIcon}
                                                <h3 className="font-semibold text-lg">{det.numero_determinacao}</h3>
                                                {bloqueado && <Lock className="h-4 w-4 text-gray-400" />}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">{det.descricao}</p>
                                            <div className="flex gap-2">
                                                {status === 'atendida' && <Badge className="bg-green-600">Atendida</Badge>}
                                                {status === 'nao_atendida' && <Badge className="bg-red-600">Não Atendida - Auto Gerado</Badge>}
                                                {status === 'aguardando_analise' && <Badge className="bg-yellow-600">Aguardando Análise</Badge>}
                                                {status === 'pendente' && <Badge className="bg-gray-500">Pendente</Badge>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {(status === 'atendida' || status === 'nao_atendida') && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleAbrirAnalise(det, index)}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    Visualizar
                                                </Button>
                                            )}
                                            {status !== 'atendida' && status !== 'nao_atendida' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAbrirAnalise(det, index)}
                                                    disabled={bloqueado}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    Analisar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Dialog de Análise */}
                <Dialog open={detalheDeterminacao !== null} onOpenChange={(open) => !open && setDetalheDeterminacao(null)}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Análise da Determinação {detalheDeterminacao?.numero_determinacao}</DialogTitle>
                        </DialogHeader>
                        {detalheDeterminacao && (
                            <div className="space-y-4">
                                <div>
                                    <p className="font-medium mb-2">Texto Completo da Determinação:</p>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">{detalheDeterminacao.descricao}</p>
                                </div>

                                <div className="border-t pt-4">
                                    <p className="font-medium mb-2">Manifestação do Prestador:</p>
                                    <Textarea
                                        placeholder="Insira aqui o que o prestador manifestou sobre esta determinação..."
                                        value={analiseForm.manifestacao_prestador || ''}
                                        onChange={(e) => setAnaliseForm({ ...analiseForm, manifestacao_prestador: e.target.value })}
                                        className="min-h-24"
                                    />
                                </div>

                                {termo.arquivos_resposta?.length > 0 && (
                                    <div className="border-t pt-4">
                                        <p className="font-medium mb-2">Arquivo de Resposta do Prestador:</p>
                                        {termo.arquivos_resposta.map((arquivo, idx) => (
                                            <Button
                                                key={idx}
                                                variant="outline"
                                                onClick={() => window.open(arquivo.url, '_blank')}
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Visualizar PDF em Nova Janela
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                <div className="border-t pt-4">
                                    <p className="font-medium mb-2">Sua Análise:</p>
                                    <Textarea
                                        placeholder="Descreva sua análise técnica sobre a resposta do prestador..."
                                        value={analiseForm.descricao_atendimento}
                                        onChange={(e) => setAnaliseForm({ ...analiseForm, descricao_atendimento: e.target.value })}
                                        className="min-h-24 mb-4"
                                    />

                                    <p className="font-medium mb-3">Status da Determinação:</p>
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <Button
                                            variant={analiseForm.status === 'atendida' ? 'default' : 'outline'}
                                            onClick={() => setAnaliseForm({ ...analiseForm, status: 'atendida' })}
                                            className={analiseForm.status === 'atendida' ? 'bg-green-600 hover:bg-green-700' : ''}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Atendida
                                        </Button>
                                        <Button
                                            variant={analiseForm.status === 'nao_atendida' ? 'default' : 'outline'}
                                            onClick={() => setAnaliseForm({ ...analiseForm, status: 'nao_atendida' })}
                                            className={analiseForm.status === 'nao_atendida' ? 'bg-red-600 hover:bg-red-700' : ''}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Não Atendida
                                        </Button>
                                    </div>

                                    {analiseForm.status === 'nao_atendida' && (
                                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                            <p className="text-sm text-yellow-800">
                                                ⚠️ Ao marcar como "Não Atendida", um Auto de Infração será gerado automaticamente.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => setDetalheDeterminacao(null)}
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleSalvarAnalise}
                                        disabled={!analiseForm.status || !analiseForm.manifestacao_prestador || !analiseForm.descricao_atendimento}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        Salvar Análise
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Alert Dialog de Confirmação */}
                <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, determinacao: null })}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Análise</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você está prestes a marcar a determinação <strong>{confirmDialog.determinacao?.numero_determinacao}</strong> como{' '}
                                <strong>{analiseForm.status === 'atendida' ? 'Atendida' : 'Não Atendida'}</strong>.
                                {analiseForm.status === 'nao_atendida' && (
                                    <span className="block mt-2 text-red-600 font-medium">
                                        Um Auto de Infração será gerado automaticamente.
                                    </span>
                                )}
                                <span className="block mt-2">Deseja continuar?</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmarAnalise}>Confirmar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}