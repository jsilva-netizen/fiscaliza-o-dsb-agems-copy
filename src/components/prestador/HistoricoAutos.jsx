import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from 'lucide-react';

export default function HistoricoAutos({ autos }) {
    if (!autos || autos.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-gray-500">
                    Nenhum auto de infração registrado
                </CardContent>
            </Card>
        );
    }

    const statusColors = {
        gerado: 'bg-gray-500',
        enviado: 'bg-blue-600',
        respondido: 'bg-purple-600',
        em_analise: 'bg-orange-600',
        finalizado: 'bg-red-600'
    };

    return (
        <div className="space-y-3">
            {autos.map(auto => (
                <Card key={auto.id} className="border-red-300">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <p className="font-semibold text-sm">{auto.numero_auto}</p>
                                </div>
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{auto.motivo_infracao}</p>
                                <p className="text-xs text-gray-500">
                                    Criado: {new Date(auto.data_geracao).toLocaleDateString('pt-BR')} |
                                    Prazo: {new Date(auto.data_limite_manifestacao).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                            <Badge className={statusColors[auto.status]}>
                                {auto.status === 'gerado' && 'Gerado'}
                                {auto.status === 'enviado' && 'Enviado'}
                                {auto.status === 'respondido' && 'Respondido'}
                                {auto.status === 'em_analise' && 'Em Análise'}
                                {auto.status === 'finalizado' && 'Finalizado'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}