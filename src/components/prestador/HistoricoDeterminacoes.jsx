import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function HistoricoDeterminacoes({ determinacoes, respostas }) {
    if (!determinacoes || determinacoes.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    Nenhuma determinação registrada
                </CardContent>
            </Card>
        );
    }

    const getRespostaStatus = (detId) => {
        return respostas?.find(r => r.determinacao_id === detId);
    };

    return (
        <div className="space-y-3">
            {determinacoes.map(det => {
                const resposta = getRespostaStatus(det.id);
                const statusColors = {
                    pendente: 'bg-orange-500',
                    atendida: 'bg-green-600',
                    justificada: 'bg-blue-600',
                    nao_atendida: 'bg-red-600'
                };
                
                return (
                    <Card key={det.id} className={resposta?.status === 'nao_atendida' ? 'border-red-300 bg-red-50' : ''}>
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <p className="font-semibold text-sm mb-1">{det.numero_determinacao}</p>
                                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{det.descricao}</p>
                                    <p className="text-xs text-gray-500">
                                        Vencimento: {new Date(det.data_limite).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <Badge className={statusColors[resposta?.status || 'pendente']}>
                                    {resposta?.status === 'atendida' && 'Atendida'}
                                    {resposta?.status === 'justificada' && 'Justificada'}
                                    {resposta?.status === 'nao_atendida' && 'Não Atendida'}
                                    {!resposta && 'Pendente'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}