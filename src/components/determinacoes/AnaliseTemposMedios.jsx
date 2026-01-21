import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Clock } from 'lucide-react';

export default function AnaliseTemposMedios({ determinacoes, respostas }) {
    // Calcular tempo médio de resposta
    const temposResposta = respostas
        .filter(r => r.data_resposta)
        .map(r => {
            const det = determinacoes.find(d => d.id === r.determinacao_id);
            if (!det) return null;
            const dias = Math.ceil(
                (new Date(r.data_resposta) - new Date(det.created_date)) / (1000 * 60 * 60 * 24)
            );
            return dias;
        })
        .filter(Boolean);

    const tempoMedioResposta = temposResposta.length > 0
        ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
        : 0;

    // Tempo médio para atendimento (prazo padrão é 15 dias)
    const tempoMedioAtendimento = determinacoes.length > 0
        ? Math.round(determinacoes.reduce((sum, d) => sum + (d.prazo_dias || 15), 0) / determinacoes.length)
        : 0;

    return (
        <div className="grid grid-cols-2 gap-4">
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <Clock className="h-8 w-8 text-blue-500" />
                        <div>
                            <p className="text-sm text-gray-600">Tempo Médio Resposta</p>
                            <p className="text-2xl font-bold text-blue-600">{tempoMedioResposta}</p>
                            <p className="text-xs text-gray-500">dias</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-orange-500" />
                        <div>
                            <p className="text-sm text-gray-600">Prazo Atendimento</p>
                            <p className="text-2xl font-bold text-orange-600">{tempoMedioAtendimento}</p>
                            <p className="text-xs text-gray-500">dias</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}