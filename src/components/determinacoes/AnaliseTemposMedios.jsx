import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Clock, Zap } from 'lucide-react';

export default function AnaliseTemposMedios({ determinacoes, respostas, julgamentos }) {
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

    // Calcular tempo médio de julgamento
    const temposJulgamento = julgamentos
        .filter(j => j.data_julgamento)
        .map(j => {
            const auto = respostas.find(r => r.determinacao_id === j.auto_id)?.determinacao_id;
            if (!auto) return null;
            // Assumindo que a manifestação foi feita ao criar o auto
            const dias = Math.ceil(
                (new Date(j.data_julgamento) - new Date(j.created_date)) / (1000 * 60 * 60 * 24)
            );
            return dias;
        })
        .filter(Boolean);

    const tempoMedioJulgamento = temposJulgamento.length > 0
        ? Math.round(temposJulgamento.reduce((a, b) => a + b, 0) / temposJulgamento.length)
        : 0;

    // Tempo médio para atendimento (prazo padrão é 15 dias)
    const tempoMedioAtendimento = determinacoes.length > 0
        ? Math.round(determinacoes.reduce((sum, d) => sum + (d.prazo_dias || 15), 0) / determinacoes.length)
        : 0;

    const dadosTempos = [
        { label: 'Resposta Média', dias: tempoMedioResposta },
        { label: 'Julgamento Médio', dias: tempoMedioJulgamento },
        { label: 'Prazo Atendimento', dias: tempoMedioAtendimento }
    ];

    return (
        <div className="grid grid-cols-3 gap-4">
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
                        <Zap className="h-8 w-8 text-purple-500" />
                        <div>
                            <p className="text-sm text-gray-600">Tempo Médio Julgamento</p>
                            <p className="text-2xl font-bold text-purple-600">{tempoMedioJulgamento}</p>
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